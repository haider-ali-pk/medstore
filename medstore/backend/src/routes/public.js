const router = require("express").Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendMail } = require("../notify");
const { priceCoupon } = require("../coupons");
const { z } = require("zod");
const { prisma, signToken, resolveBrand, auth, cached, loginLimiter, publicUser } = require("../lib");

router.use(resolveBrand);

const publicBrand = (b) => ({
  id: b.id, slug: b.slug, name: b.name, tagline: b.tagline, logoUrl: b.logoUrl,
  primaryColor: b.primaryColor, accentColor: b.accentColor, currency: b.currency,
  phone: b.phone, whatsapp: b.whatsapp, email: b.email, address: b.address,
  licenseNo: b.licenseNo, openingHours: b.openingHours,
  deliveryFee: Number(b.deliveryFee || 0),
  freeDeliveryOver: b.freeDeliveryOver == null ? null : Number(b.freeDeliveryOver),
  codEnabled: b.codEnabled, cardEnabled: b.cardEnabled, walletEnabled: b.walletEnabled,
    paymentInstructions: b.paymentInstructions, gaId: b.gaId,
});

// ---- Brand info (theme, logo, contact, enabled payment methods)
router.get("/brand", (req, res) => res.json(publicBrand(req.brand)));

// ---- Auth (customers register per brand)
const registerSchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
});

router.post("/auth/register", loginLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { name, email, password, phone } = parsed.data;
  const exists = await prisma.user.findUnique({
    where: { email_brandId: { email: email.toLowerCase(), brandId: req.brand.id } },
  });
  if (exists) return res.status(409).json({ error: "Email already registered" });
  const user = await prisma.user.create({
    data: { name, phone, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 10), role: "CUSTOMER", brandId: req.brand.id },
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

/**
 * One login form for everybody.
 * 1) customer / brand admin of THIS brand  2) platform super admin (works on every brand site)
 */
router.post("/auth/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const em = String(email).trim().toLowerCase();

  let user = await prisma.user.findUnique({ where: { email_brandId: { email: em, brandId: req.brand.id } } });
  let ok = !!user && (await bcrypt.compare(String(password), user.passwordHash));

  if (!ok) {
    const sup = await prisma.user.findFirst({ where: { email: em, role: "SUPER_ADMIN" } });
    if (sup && (await bcrypt.compare(String(password), sup.passwordHash))) {
      user = sup;
      ok = true;
    }
  }
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get("/auth/me", auth(), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

// ---- Catalog (cached 30s in memory: the catalogue changes rarely, the DB is remote)
const LIST_SELECT = {
  id: true, name: true, slug: true, price: true, comparePrice: true, genericName: true, manufacturer: true, imageUrl: true, stock: true, requiresRx: true,
  category: { select: { name: true, slug: true } },
};

const loadCategories = (brandId) =>
  cached(`pub:${brandId}:cats`, 30_000, () =>
    prisma.category.findMany({
      where: { brandId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, _count: { select: { products: { where: { isActive: true } } } } },
    })
  );

router.get("/categories", async (req, res) => res.json(await loadCategories(req.brand.id)));

async function loadProducts(brandId, { q, category, page = "1", limit = "12" }) {
  const take = Math.min(parseInt(limit) || 12, 48);
  const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;
  const where = {
    brandId,
    isActive: true,
    ...(q ? { name: { contains: String(q).slice(0, 80), mode: "insensitive" } } : {}),
    ...(category ? { category: { slug: String(category) } } : {}),
  };
  const key = `pub:${brandId}:p:${JSON.stringify([q || "", category || "", take, skip])}`;
  return cached(key, 30_000, async () => {
    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, select: LIST_SELECT, orderBy: { createdAt: "desc" }, take, skip }),
      prisma.product.count({ where }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pages: Math.ceil(total / take) };
  });
}

router.get("/products", async (req, res) => res.json(await loadProducts(req.brand.id, req.query)));

// Home page in ONE round trip instead of three.
router.get("/storefront/home", async (req, res) => {
  const [categories, products] = await Promise.all([
    loadCategories(req.brand.id),
    loadProducts(req.brand.id, { limit: "8" }),
  ]);
  res.json({ brand: publicBrand(req.brand), categories, products });
});

router.get("/products/:slug", async (req, res) => {
  const product = await cached(`pub:${req.brand.id}:slug:${req.params.slug}`, 30_000, () =>
    prisma.product.findFirst({
      where: { brandId: req.brand.id, slug: req.params.slug, isActive: true },
      include: { category: { select: { name: true, slug: true } } },
    })
  );
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});
// Text of the About / Terms / Privacy / Returns / Delivery pages (kept out of /brand so every page load stays small)
router.get("/policies", (req, res) => {
  const b = req.brand;
  res.json({
    aboutText: b.aboutText, termsText: b.termsText, privacyText: b.privacyText,
    returnPolicy: b.returnPolicy, shippingPolicy: b.shippingPolicy,
  });
});
// Branch list for the website
router.get("/branches", async (req, res) =>
  res.json(
    await cached(`pub:${req.brand.id}:branches`, 30_000, () =>
      prisma.branch.findMany({
        where: { brandId: req.brand.id, isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, address: true, city: true, phone: true, whatsapp: true, openingHours: true, mapUrl: true },
      })
    )
  )
);
/* ---------- Forgot / reset password ---------- */
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

router.post("/auth/forgot", loginLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email" });
  const user = await prisma.user.findUnique({ where: { email_brandId: { email, brandId: req.brand.id } } });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
    await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    // The link never uses the request's Origin/Host (that could be faked): only the store's own domain or FRONTEND_URL.
    const d = req.brand.domain;
    const front = d && !/localhost/i.test(d) ? `https://${d}` : (process.env.FRONTEND_URL || "http://localhost:3000").split(",")[0].trim();
    await sendMail({
      to: user.email,
      subject: `Reset your ${req.brand.name} password`,
      brandName: req.brand.name,
      text: `Hello ${user.name},\n\nUse this link to choose a new password. It works for 1 hour:\n${front}/reset-password?token=${token}\n\nIf you did not ask for this, you can ignore this email.`,
    }).catch((e) => console.warn("Reset email failed:", e.message));
  }
  // same answer whether or not the account exists
  res.json({ ok: true, message: "If that email has an account, we have sent a reset link. Check your inbox and spam folder." });
});

router.post("/auth/reset", loginLimiter, async (req, res) => {
  const password = String(req.body?.password || "");
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  const rec = await prisma.passwordReset.findUnique({ where: { tokenHash: sha(String(req.body?.token || "")) }, include: { user: true } });
  if (!rec || rec.expiresAt < new Date() || rec.user.brandId !== req.brand.id)
    return res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: await bcrypt.hash(password, 10) } }),
    prisma.passwordReset.deleteMany({ where: { userId: rec.userId } }),
  ]);
  res.json({ ok: true });
});

/* ---------- Coupons, banners, branch stock, sitemap ---------- */
router.post("/coupons/validate", loginLimiter, async (req, res) => {
  const subtotal = Number(req.body?.subtotal);
  if (!Number.isFinite(subtotal) || subtotal <= 0) return res.status(400).json({ error: "Your cart is empty" });
  const { coupon, discount } = await priceCoupon(req.brand.id, req.body?.code, subtotal);
  if (!coupon) return res.status(400).json({ error: "Enter a coupon code" });
  res.json({ code: coupon.code, discount });
});

router.get("/banners", async (req, res) =>
  res.json(
    await cached(`pub:${req.brand.id}:banners`, 30_000, () =>
      prisma.banner.findMany({
        where: { brandId: req.brand.id, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: { id: true, title: true, subtitle: true, buttonText: true, linkUrl: true, imageUrl: true },
      })
    )
  )
);

// how many of each cart item the chosen branch has: { productId: qty }
router.get("/branches/:id/stock", async (req, res) => {
  const ids = String(req.query.ids || "").split(",").filter(Boolean).slice(0, 100);
  const rows = await prisma.branchStock.findMany({
    where: { branchId: req.params.id, productId: { in: ids }, branch: { brandId: req.brand.id, isActive: true } },
    select: { productId: true, stock: true },
  });
  res.json(Object.fromEntries(rows.map((r) => [r.productId, r.stock])));
});

router.get("/sitemap", async (req, res) =>
  res.json(
    await cached(`pub:${req.brand.id}:sitemap`, 300_000, async () => {
      const [products, categories] = await Promise.all([
        prisma.product.findMany({ where: { brandId: req.brand.id, isActive: true }, select: { slug: true, createdAt: true }, take: 5000 }),
        prisma.category.findMany({ where: { brandId: req.brand.id }, select: { slug: true } }),
      ]);
      return { products, categories };
    })
  )
);
module.exports = router;
module.exports.publicBrand = publicBrand;
