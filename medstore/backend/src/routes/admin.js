const router = require("express").Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { z } = require("zod");
const { prisma, signToken, resolveBrand, auth, requireRole, sameBrandOrSuper, slugify, bust, loginLimiter } = require("../lib");
const { brandAnalytics } = require("../analytics");
const { uploadImage, signedUrl, configured: storageConfigured } = require("../storage");
const svc = require("../services");

const afterChange = (brandId) => { bust(`pub:${brandId}`); bust(`an:${brandId}`); bust("brand:"); };

/* ============================================================
   SUPER ADMIN  (platform owner: you)  — mounted at /api/super
   ============================================================ */
const superRouter = require("express").Router();

superRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const user = await prisma.user.findFirst({
    where: { email: String(email || "").trim().toLowerCase(), role: "SUPER_ADMIN" },
  });
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash)))
    return res.status(401).json({ error: "Invalid email or password" });
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

superRouter.use(auth(), requireRole("SUPER_ADMIN"));

superRouter.get("/brands", async (_req, res) => {
  const brands = await prisma.brand.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { products: true, orders: true, users: true } } },
  });
  res.json(brands);
});

// Platform-wide numbers (all brands) for the super admin overview.
superRouter.get("/overview", async (_req, res) => {
  const brands = await prisma.brand.findMany({ select: { id: true, name: true, slug: true, currency: true, isActive: true } });
  const rows = await Promise.all(
    brands.map(async (b) => {
      const a = await brandAnalytics(b.id, 14);
      return { ...b, totals: a.totals, today: a.today, periodRevenue: a.periodRevenue };
    })
  );
  res.json(rows);
});

const money = z.coerce.number().min(0).max(1_000_000);
const brandSchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  domain: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  currency: z.string().length(3).optional(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
    address: z.string().max(200).optional().nullable(),
  licenseNo: z.string().max(60).optional().nullable(),
  openingHours: z.string().max(80).optional().nullable(),
  deliveryFee: money.optional(),
  freeDeliveryOver: money.optional().nullable(),
  codEnabled: z.boolean().optional(),
  cardEnabled: z.boolean().optional(),
  walletEnabled: z.boolean().optional(),
  paymentInstructions: z.string().max(500).optional().nullable(),
  adminEmail: z.string().email(),
  adminName: z.string().optional(),
  adminPassword: z.string().min(8).optional(),
});
const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === "" ? null : v]));

superRouter.post("/brands", async (req, res) => {
  const parsed = brandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { adminEmail, adminName, adminPassword, slug, ...brandData } = parsed.data;
  const finalSlug = slugify(slug || brandData.name);
  if (await prisma.brand.findUnique({ where: { slug: finalSlug } }))
    return res.status(409).json({ error: "Brand slug already exists" });

  const password = adminPassword || crypto.randomBytes(9).toString("base64url");
  const brand = await prisma.brand.create({
    data: {
      ...clean(brandData),
      currency: brandData.currency || "PKR",
      slug: finalSlug,
      users: {
        create: {
          email: adminEmail.toLowerCase(),
          name: adminName || `${brandData.name} Admin`,
          passwordHash: await bcrypt.hash(password, 10),
          role: "BRAND_ADMIN",
        },
      },
    },
  });
  res.status(201).json({ brand, credentials: { email: adminEmail, password, loginSlug: brand.slug } });
});

superRouter.patch("/brands/:id", async (req, res) => {
  const parsed = brandSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { adminEmail, adminName, adminPassword, ...data } = parsed.data;
  const brand = await prisma.brand.update({ where: { id: req.params.id }, data: clean(data) });
  afterChange(brand.id);
  res.json(brand);
});

superRouter.post("/brands/:id/toggle", async (req, res) => {
  const b = await prisma.brand.findUnique({ where: { id: req.params.id } });
  if (!b) return res.status(404).json({ error: "Not found" });
  const out = await prisma.brand.update({ where: { id: b.id }, data: { isActive: !b.isActive } });
  afterChange(b.id);
  res.json(out);
});

superRouter.post("/brands/:id/reset-admin-password", async (req, res) => {
  const admin = await prisma.user.findFirst({ where: { brandId: req.params.id, role: "BRAND_ADMIN" } });
  if (!admin) return res.status(404).json({ error: "No admin for this brand" });
  const password = crypto.randomBytes(9).toString("base64url");
  await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  res.json({ email: admin.email, password });
});

/* ============================================================
   BRAND ADMIN  (the pharmacy / client)  — mounted at /api/admin
   Super admin can also use every route here on any brand.
   ============================================================ */
router.use(resolveBrand, auth(), requireRole("BRAND_ADMIN", "SUPER_ADMIN"), sameBrandOrSuper);

router.get("/stats", async (req, res) => res.json(await brandAnalytics(req.brand.id, 14)));

// ---- Shop settings (name, logo, contact, delivery, payments)
const settingsSchema = brandSchema
  .pick({
    name: true, tagline: true, logoUrl: true, primaryColor: true, accentColor: true, phone: true, whatsapp: true,
    email: true, address: true, licenseNo: true, openingHours: true, deliveryFee: true, freeDeliveryOver: true, codEnabled: true, cardEnabled: true,
    walletEnabled: true, paymentInstructions: true,
  })
  .partial();

router.get("/brand", (req, res) => res.json({ ...req.brand, uploadsEnabled: storageConfigured() }));

router.put("/brand", async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const brand = await prisma.brand.update({ where: { id: req.brand.id }, data: clean(parsed.data) });
  afterChange(brand.id);
  res.json(brand);
});

// ---- Picture upload (browser sends a resized image as a data URL)
router.post("/upload", async (req, res) => {
  const url = await uploadImage(req.body?.dataUrl, req.body?.folder === "logo" ? "logos" : "products").catch((e) => {
    res.status(e.status || 500).json({ error: e.message });
    return null;
  });
  if (url) res.json({ url });
});

// ---- Categories
router.get("/categories", async (req, res) =>
  res.json(await prisma.category.findMany({ where: { brandId: req.brand.id }, orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }))
);
router.post("/categories", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name required" });
  const slug = slugify(name);
  if (await prisma.category.findUnique({ where: { brandId_slug: { brandId: req.brand.id, slug } } }))
    return res.status(409).json({ error: "That category already exists" });
  const c = await prisma.category.create({ data: { brandId: req.brand.id, name, slug } });
  afterChange(req.brand.id);
  res.status(201).json(c);
});
router.put("/categories/:id", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name required" });
  const r = await prisma.category.updateMany({ where: { id: req.params.id, brandId: req.brand.id }, data: { name, slug: slugify(name) } });
  if (!r.count) return res.status(404).json({ error: "Not found" });
  afterChange(req.brand.id);
  res.json({ ok: true });
});
router.delete("/categories/:id", async (req, res) => {
  await prisma.category.deleteMany({ where: { id: req.params.id, brandId: req.brand.id } }); // products become "no category"
  afterChange(req.brand.id);
  res.json({ ok: true });
});

// ---- Products (full create / edit / hide / delete). The rules live in ../services.js (shared with MediCore).
router.get("/products", async (req, res) =>
  res.json(
    await prisma.product.findMany({
      where: { brandId: req.brand.id },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    })
  )
);
router.post("/products", async (req, res) => res.status(201).json(await svc.createProduct(req.brand, req.body)));
router.put("/products/:id", async (req, res) => res.json(await svc.updateProduct(req.brand, req.params.id, req.body)));
router.delete("/products/:id", async (req, res) => res.json(await svc.deleteProduct(req.brand, req.params.id)));

// ---- Orders
router.get("/orders", async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { brandId: req.brand.id },
    include: { items: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(orders.map(({ prescriptionPath, ...o }) => ({ ...o, hasPrescription: !!prescriptionPath })));
});

router.patch("/orders/:id", async (req, res) => {
  await svc.updateOrder(req.brand, req.params.id, req.body || {});
  res.json({ ok: true });
});

// Opens the customer's prescription through a link that expires after 10 minutes.
router.get("/orders/:id/prescription", async (req, res) => {
  const o = await prisma.order.findFirst({ where: { id: req.params.id, brandId: req.brand.id }, select: { prescriptionPath: true } });
  if (!o?.prescriptionPath) return res.status(404).json({ error: "No prescription on this order" });
  res.json({ url: await signedUrl(o.prescriptionPath, 600) });
});

module.exports = { adminRouter: router, superRouter };