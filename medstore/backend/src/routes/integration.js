// backend/src/routes/integration.js   (REPLACE THE WHOLE FILE)
// The MediCore <-> MedStore API. Every route needs the header  x-api-key: <INTEGRATION_API_KEY>
// It is called by MediCore's SERVER (never by a browser), so the key stays secret.
//
//   GET    /api/integration/analytics?days=14&brand=slug
//   GET    /api/integration/brands
//   GET    /api/integration/orders?brand=&status=&q=&page=&limit=
//   PATCH  /api/integration/orders/:id                 { status?, paymentStatus? }
//   GET    /api/integration/orders/:id/prescription    -> { url }   (link valid for 10 minutes)
//   GET    /api/integration/products?brand=&q=&page=&limit=
//   POST   /api/integration/products                   create
//   PUT    /api/integration/products/:id               edit (price, name, visibility ...)
//   PATCH  /api/integration/products/:id/stock         { stock } or { delta }
//   DELETE /api/integration/products/:id
//   POST   /api/integration/products/sync              { items: [{ externalId, name, price, stock, ... }] }
const router = require("express").Router();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { prisma, slugify } = require("../lib");
const { brandAnalytics } = require("../analytics");
const svc = require("../services");
const { signedUrl } = require("../storage");

router.use((req, res, next) => {
  const key = process.env.INTEGRATION_API_KEY;
  const given = String(req.headers["x-api-key"] || "");
  const ok = key && key.length >= 24 && given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
  if (!ok) return res.status(401).json({ error: "Invalid API key" });
  next();
});
// Tells the shared brand resolver which store this call is for.
// MediCore sends ?brand=slug; otherwise INTEGRATION_DEFAULT_BRAND; otherwise the only active store.
router.use(async (req, _res, next) => {
  try {
    if (!req.headers["x-brand-slug"]) {
      let slug = String(req.query.brand || process.env.INTEGRATION_DEFAULT_BRAND || "");
      if (!slug) {
        const all = await prisma.brand.findMany({ where: { isActive: true }, select: { slug: true }, take: 2 });
        if (all.length === 1) slug = all[0].slug;
      }
      if (slug) req.headers["x-brand-slug"] = slug;
    }
    next();
  } catch (e) {
    next(e);
  }
});
// Which store? ?brand=slug  ->  INTEGRATION_DEFAULT_BRAND  ->  the only active store.
async function pickBrand(req, res, next) {
  const slug = String(req.query.brand || req.headers["x-brand-slug"] || process.env.INTEGRATION_DEFAULT_BRAND || "");
  let brand = null;
  if (slug) brand = await prisma.brand.findUnique({ where: { slug } });
  else {
    const all = await prisma.brand.findMany({ where: { isActive: true }, take: 2 });
    if (all.length === 1) brand = all[0];
  }
  if (!brand) {
    const known = (await prisma.brand.findMany({ select: { slug: true } })).map((b) => b.slug).join(", ");
    return res.status(400).json({
      error: slug
        ? `Store "${slug}" does not exist. Available store slugs: ${known}`
        : `No store selected. Set MEDSTORE_BRAND in MediCore to one of: ${known}`,
    });
  }
  req.brand = brand;
  next();
}

const page = (q, max = 50) => {
  const take = Math.min(Math.max(parseInt(q.limit) || 20, 1), max);
  const p = Math.max(parseInt(q.page) || 1, 1);
  return { take, skip: (p - 1) * take, p };
};

/* ---------- analytics ---------- */
router.get("/analytics", async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days) || 14, 1), 90);
  const brands = await prisma.brand.findMany({
    where: { isActive: true, ...(req.query.brand ? { slug: String(req.query.brand) } : {}) },
    select: { id: true, slug: true, name: true, currency: true },
  });
  const rows = await Promise.all(brands.map(async (b) => ({ ...b, ...(await brandAnalytics(b.id, days)) })));
  const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
  res.json({
    source: "medstore",
    generatedAt: new Date().toISOString(),
    currency: "PKR",
    summary: {
      brands: rows.length,
      orders: sum((r) => r.totals.orders),
      revenue: sum((r) => r.totals.revenue),
      collected: sum((r) => r.totals.collected),
      customers: sum((r) => r.totals.customers),
      pendingOrders: sum((r) => r.totals.pending),
      revenueToday: sum((r) => r.today.revenue),
    },
    brands: rows,
  });
});

router.get("/brands", async (_req, res) =>
  res.json(await prisma.brand.findMany({ where: { isActive: true }, select: { id: true, slug: true, name: true } }))
);

/* ---------- orders ---------- */
router.get("/orders", pickBrand, async (req, res) => {
  const { take, skip, p } = page(req.query);
  const q = String(req.query.q || "").trim().slice(0, 60);
  const status = svc.STATUSES.includes(req.query.status) ? req.query.status : undefined;
  const where = {
    brandId: req.brand.id,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { shipName: { contains: q, mode: "insensitive" } },
            { shipPhone: { contains: q } },
            ...(/^\d{1,9}$/.test(q.replace(/^MS-/i, "")) ? [{ orderNo: Number(q.replace(/^MS-/i, "")) }] : []),
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where, orderBy: { createdAt: "desc" }, take, skip,
      include: { items: true, user: { select: { name: true, email: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  res.json({
    items: items.map(({ prescriptionPath, ...o }) => ({ ...o, hasPrescription: !!prescriptionPath })),
    total, page: p, pages: Math.ceil(total / take),
  });
});

router.patch("/orders/:id", pickBrand, async (req, res) => {
  const o = await svc.updateOrder(req.brand, req.params.id, { status: req.body?.status, paymentStatus: req.body?.paymentStatus });
  res.json({ ok: true, status: o.status, paymentStatus: o.paymentStatus });
});

router.get("/orders/:id/prescription", pickBrand, async (req, res) => {
  const o = await prisma.order.findFirst({ where: { id: req.params.id, brandId: req.brand.id }, select: { prescriptionPath: true } });
  if (!o?.prescriptionPath) return res.status(404).json({ error: "No prescription on this order" });
  res.json({ url: await signedUrl(o.prescriptionPath, 600) });
});

/* ---------- products ---------- */
router.get("/products", pickBrand, async (req, res) => {
  const { take, skip, p } = page(req.query, 100);
  const q = String(req.query.q || "").trim().slice(0, 60);
  const where = { brandId: req.brand.id, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) };
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, include: { category: { select: { id: true, name: true } } } }),
    prisma.product.count({ where }),
  ]);
  res.json({ items, total, page: p, pages: Math.ceil(total / take) });
});

const syncSchema = z.object({ items: z.array(z.object({ externalId: z.string().min(1) }).passthrough()).min(1).max(200) });
router.post("/products/sync", pickBrand, async (req, res) => {
  const r = syncSchema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ error: "Send { items: [ { externalId, ... } ] } (max 200)" });
  res.json(await svc.syncProducts(req.brand, r.data.items));
});

router.post("/products", pickBrand, async (req, res) => res.status(201).json(await svc.createProduct(req.brand, req.body)));
router.put("/products/:id", pickBrand, async (req, res) => res.json(await svc.updateProduct(req.brand, req.params.id, req.body)));
router.patch("/products/:id/stock", pickBrand, async (req, res) => res.json(await svc.adjustStock(req.brand, req.params.id, req.body || {})));
router.delete("/products/:id", pickBrand, async (req, res) => res.json(await svc.deleteProduct(req.brand, req.params.id)));
/* ---------- store info & pages (MediCore "Store info & pages" tab) ---------- */
const optT = (n) => z.string().max(n).optional().nullable().or(z.literal(""));
const money = z.coerce.number().min(0).max(1_000_000);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional();
const brandSchema = z.object({
  name: z.string().min(2).optional(),
  tagline: optT(200),
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
  primaryColor: hex,
  accentColor: hex,
  phone: optT(30),
  whatsapp: optT(30),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: optT(200),
  licenseNo: optT(60),
  openingHours: optT(80),
  deliveryFee: money.optional(),
  freeDeliveryOver: z.union([money, z.literal(""), z.null()]).optional(),
  codEnabled: z.boolean().optional(),
  walletEnabled: z.boolean().optional(),
  cardEnabled: z.boolean().optional(),
  paymentInstructions: optT(500),
  aboutText: optT(20000),
  termsText: optT(20000),
  privacyText: optT(20000),
  returnPolicy: optT(20000),
  shippingPolicy: optT(20000),
});

// The panel's form expects plain values: no nulls, numbers instead of decimals.
// (freeDeliveryOver must be "" when empty, otherwise the panel would save it as 0 = free delivery on everything.)
const shapeStore = (b) => {
  const o = {};
  for (const [k, v] of Object.entries(b)) o[k] = v === null ? "" : v;
  o.deliveryFee = Number(b.deliveryFee || 0);
  o.freeDeliveryOver = b.freeDeliveryOver == null ? "" : Number(b.freeDeliveryOver);
  return o;
};

router.get("/store", pickBrand, (req, res) => res.json(shapeStore(req.brand)));

router.put("/store", pickBrand, async (req, res) => {
  const r = brandSchema.safeParse(req.body || {});
  if (!r.success) return res.status(400).json({ error: r.error.issues[0].message });
  const brand = await prisma.brand.update({ where: { id: req.brand.id }, data: svc.clean(r.data) });
  svc.afterChange(brand.id);
  res.json(shapeStore(brand));
});



/* ---------- categories (so "Other Accessories" etc. can be created from MediCore) ---------- */
router.get("/categories", pickBrand, async (req, res) =>
  res.json(await prisma.category.findMany({ where: { brandId: req.brand.id }, orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }))
);
router.post("/categories", pickBrand, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name required" });
  const slug = slugify(name);
  const found = await prisma.category.findUnique({ where: { brandId_slug: { brandId: req.brand.id, slug } } });
  if (found) return res.json(found); // already exists: treat as success
  const c = await prisma.category.create({ data: { brandId: req.brand.id, name, slug } });
  svc.afterChange(req.brand.id);
  res.status(201).json(c);
});
router.put("/categories/:id", pickBrand, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name required" });
  const r = await prisma.category.updateMany({ where: { id: req.params.id, brandId: req.brand.id }, data: { name, slug: slugify(name) } });
  if (!r.count) return res.status(404).json({ error: "Not found" });
  svc.afterChange(req.brand.id);
  res.json({ ok: true });
});
router.delete("/categories/:id", pickBrand, async (req, res) => {
  await prisma.category.deleteMany({ where: { id: req.params.id, brandId: req.brand.id } });
  svc.afterChange(req.brand.id);
  res.json({ ok: true });
});
/* ---------- STORES (super admin in MediCore): add stores, their admins and their branches ---------- */
const oT = (n) => z.string().max(n).optional().nullable().or(z.literal(""));
const randomPassword = () => crypto.randomBytes(9).toString("base64url");

const storeCreateSchema = z.object({
  name: z.string().min(2, "Store name is required"),
  slug: z.string().optional(),
  domain: z.string().optional().nullable().or(z.literal("")),
  tagline: oT(200),
  phone: oT(30),
  whatsapp: oT(30),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: oT(200),
  adminName: z.string().optional(),
  adminEmail: z.string().email("Enter the admin's email"),
  adminPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
});

router.get("/stores", async (_req, res) => {
  const brands = await prisma.brand.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { products: true, orders: true } },
      users: { where: { role: "BRAND_ADMIN" }, select: { id: true, name: true, email: true } },
    },
  });
  res.json(
    brands.map((b) => ({
      id: b.id, slug: b.slug, name: b.name, domain: b.domain, isActive: b.isActive,
      products: b._count.products, orders: b._count.orders, admins: b.users,
    }))
  );
});

router.post("/stores", async (req, res) => {
  const p = storeCreateSchema.safeParse(req.body || {});
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const { adminEmail, adminName, adminPassword, slug, ...data } = p.data;
  const finalSlug = slugify(slug || data.name);
  if (!finalSlug) return res.status(400).json({ error: "Enter a store name" });
  if (await prisma.brand.findUnique({ where: { slug: finalSlug } })) return res.status(409).json({ error: "A store with this slug already exists" });
  if (data.domain && (await prisma.brand.findUnique({ where: { domain: data.domain } }))) return res.status(409).json({ error: "That domain is already used by another store" });

  const password = adminPassword || randomPassword();
  const brand = await prisma.brand.create({
    data: {
      ...svc.clean(data),
      slug: finalSlug,
      currency: "PKR",
      users: { create: { email: adminEmail.toLowerCase(), name: adminName || `${data.name} Admin`, passwordHash: await bcrypt.hash(password, 10), role: "BRAND_ADMIN" } },
    },
  });
  svc.afterChange(brand.id);
  res.status(201).json({ brand: { id: brand.id, slug: brand.slug, name: brand.name }, credentials: { email: adminEmail.toLowerCase(), password, slug: brand.slug } });
});

router.post("/stores/:id/toggle", async (req, res) => {
  const b = await prisma.brand.findUnique({ where: { id: req.params.id } });
  if (!b) return res.status(404).json({ error: "Store not found" });
  await prisma.brand.update({ where: { id: b.id }, data: { isActive: !b.isActive } });
  svc.afterChange(b.id);
  res.json({ ok: true, isActive: !b.isActive });
});

// add another admin login to a store
router.post("/stores/:id/admins", async (req, res) => {
  const p = z
    .object({ name: z.string().min(2).optional(), email: z.string().email("Enter a valid email"), password: z.string().min(8, "Password must be at least 8 characters").optional() })
    .safeParse(req.body || {});
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const brand = await prisma.brand.findUnique({ where: { id: req.params.id } });
  if (!brand) return res.status(404).json({ error: "Store not found" });
  const email = p.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email_brandId: { email, brandId: brand.id } } }))
    return res.status(409).json({ error: "That email is already registered on this store. Use a different email." });
  const password = p.data.password || randomPassword();
  const user = await prisma.user.create({
    data: { email, name: p.data.name || `${brand.name} Admin`, passwordHash: await bcrypt.hash(password, 10), role: "BRAND_ADMIN", brandId: brand.id },
  });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email }, credentials: { email, password } });
});

router.post("/stores/:id/admins/:userId/password", async (req, res) => {
  const password = req.body?.password ? String(req.body.password) : randomPassword();
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  const r = await prisma.user.updateMany({
    where: { id: req.params.userId, brandId: req.params.id, role: "BRAND_ADMIN" },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  if (!r.count) return res.status(404).json({ error: "Admin not found" });
  res.json({ password });
});

// branches of any store
const branchSchemaI = z.object({
  name: z.string().min(2, "Branch name is required").max(100),
  address: z.string().min(3, "Address is required").max(250),
  city: oT(60), phone: oT(30), whatsapp: oT(30), openingHours: oT(80),
  mapUrl: z.string().url("Map link must be a full link").refine((u) => /^https?:\/\//i.test(u), "Map link must start with http").optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional(),
});

router.get("/stores/:id/branches", async (req, res) =>
  res.json(await prisma.branch.findMany({ where: { brandId: req.params.id }, orderBy: { createdAt: "asc" } }))
);
router.post("/stores/:id/branches", async (req, res) => {
  const p = branchSchemaI.safeParse(req.body || {});
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  if (!(await prisma.brand.findUnique({ where: { id: req.params.id }, select: { id: true } }))) return res.status(404).json({ error: "Store not found" });
  const b = await prisma.branch.create({ data: { ...svc.clean(p.data), brandId: req.params.id } });
  svc.afterChange(req.params.id);
  res.status(201).json(b);
});
router.put("/stores/:id/branches/:bid", async (req, res) => {
  const p = branchSchemaI.partial().safeParse(req.body || {});
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const r = await prisma.branch.updateMany({ where: { id: req.params.bid, brandId: req.params.id }, data: svc.clean(p.data) });
  if (!r.count) return res.status(404).json({ error: "Branch not found" });
  svc.afterChange(req.params.id);
  res.json({ ok: true });
});
router.delete("/stores/:id/branches/:bid", async (req, res) => {
  await prisma.branch.deleteMany({ where: { id: req.params.bid, brandId: req.params.id } });
  svc.afterChange(req.params.id);
  res.json({ ok: true });
});
module.exports = router;