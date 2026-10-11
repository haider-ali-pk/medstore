require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");

const globalForPrisma = globalThis;
const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({ datasources: { db: { url: require("./dburl")() } } });
if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = prisma;

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
if ((process.env.NODE_ENV === "production" || process.env.VERCEL) && JWT_SECRET === "dev-secret")
  throw new Error("JWT_SECRET is not set. Set a long random value (32+ characters) in the environment variables.");
const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, brandId: user.brandId }, JWT_SECRET, { expiresIn: "7d" });

/* ---------- tiny in-memory TTL cache (per server instance) ---------- */
const store = new Map();
function cached(key, ttlMs, loader) {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.val);
  return loader().then((val) => {
    store.set(key, { val, exp: Date.now() + ttlMs });
    if (store.size > 500) store.delete(store.keys().next().value);
    return val;
  });
}
const bust = (prefix) => {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
};

/**
 * Resolves which brand this request is for. The brand row is cached for 60s so the
 * (remote) database is not hit on every single API call.
 * Priority: x-brand-slug header -> x-brand-host header / Host header (custom domain).
 */
async function resolveBrand(req, res, next) {
  try {
    const slug = req.headers["x-brand-slug"];
    const host = (req.headers["x-brand-host"] || req.headers.host || "").toString().split(":")[0];
    let brand = null;
    if (slug) brand = await cached(`brand:slug:${slug}`, 60_000, () => prisma.brand.findUnique({ where: { slug: String(slug) } }));
    if (!brand && host) brand = await cached(`brand:host:${host}`, 60_000, () => prisma.brand.findUnique({ where: { domain: host } }));
    if (!brand || !brand.isActive) return res.status(404).json({ error: "Brand not found" });
    req.brand = brand;
    next();
  } catch (e) {
    next(e);
  }
}

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return required ? res.status(401).json({ error: "Login required" }) : next();
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

const requireRole = (...roles) => (req, res, next) =>
  req.user && roles.includes(req.user.role) ? next() : res.status(403).json({ error: "Forbidden" });

// Brand admins may only act on their own brand; super admins on any.
const sameBrandOrSuper = (req, res, next) => {
  if (req.user.role === "SUPER_ADMIN") return next();
  if (req.user.brandId && req.user.brandId === req.brand.id) return next();
  return res.status(403).json({ error: "Wrong brand" });
};

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* ---------- simple login rate limit (per IP, in memory) ---------- */
const attempts = new Map();
function loginLimiter(req, res, next) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
  const now = Date.now();
  const rec = attempts.get(ip) || { n: 0, t: now };
  if (now - rec.t > 15 * 60_000) { rec.n = 0; rec.t = now; }
  if (rec.n >= 20) return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
  rec.n += 1;
  attempts.set(ip, rec);
  if (attempts.size > 2000) attempts.delete(attempts.keys().next().value);
  next();
}
// 0300-1234567 / +92 300 1234567 / 923001234567  ->  "03001234567"   (null when it is not a Pakistani mobile number)
function normalizePkPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(4);
  else if (d.startsWith("92")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return /^3\d{9}$/.test(d) ? "0" + d : null;
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

module.exports = {
  prisma, signToken, resolveBrand, auth, requireRole, sameBrandOrSuper,
    slugify, cached, bust, loginLimiter, publicUser, normalizePkPhone,
};
