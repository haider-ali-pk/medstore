const router = require("express").Router();
const bcrypt = require("bcryptjs");
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
  paymentInstructions: b.paymentInstructions,
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
module.exports = router;
module.exports.publicBrand = publicBrand;
