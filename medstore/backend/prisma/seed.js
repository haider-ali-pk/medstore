require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient({ datasources: { db: { url: require("../src/dburl")() } } });

// Demo catalogue. Prices are in PKR. Pictures are uploaded later from the admin panel.
const brands = [
  {
    slug: "carewell",
    name: "CareWell Pharmacy",
    domain: "carewell.localhost",
    tagline: "Trusted care, delivered to your door",
    primaryColor: "#0f766e",
    accentColor: "#0ea5e9",
    phone: "+92 300 0000000",
    whatsapp: "923000000000",
    email: "care@carewell.test",
    address: "Main Boulevard, Lahore, Pakistan",
    cardEnabled: false,
    walletEnabled: true,
    paymentInstructions: "Send the amount to JazzCash / Easypaisa 0300-0000000 (CareWell Pharmacy), then enter the transaction ID.",
    admin: "admin@carewell.test",
    products: [
      ["Paracetamol 500mg (20 tabs)", "Pain & Fever", 120, false],
      ["Vitamin C 1000mg (60 tabs)", "Vitamins", 1850, false],
      ["Digital Thermometer", "Devices", 950, false],
      ["Amoxicillin 500mg (14 caps)", "Prescription", 680, true],
      ["Digital BP Monitor", "Devices", 6500, false],
      ["ORS Sachets (10 pcs)", "Pain & Fever", 220, false],
    ],
  },
  {
    slug: "novacare",
    name: "NovaCare Hospital Store",
    domain: "novacare.localhost",
    tagline: "Hospital-grade supplies for every home",
    primaryColor: "#4338ca",
    accentColor: "#f59e0b",
    cardEnabled: false,
    admin: "admin@novacare.test",
    products: [
      ["Blood Pressure Monitor", "Devices", 7800, false],
      ["Surgical Masks (50 pcs)", "Protection", 450, false],
      ["Multivitamin Daily (30 tabs)", "Vitamins", 1650, false],
    ],
  },
];

async function main() {
  // Super admin: created if missing, and the password is re-synced from .env every time you run the seed.
  const email = (process.env.SUPER_ADMIN_EMAIL || "admin@medstore.local").trim().toLowerCase();
  const passwordHash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD || "ChangeMe123!", 10);
  const exists = await prisma.user.findFirst({ where: { email, role: "SUPER_ADMIN" } });
  if (exists) await prisma.user.update({ where: { id: exists.id }, data: { passwordHash } });
  else await prisma.user.create({ data: { email, name: "Super Admin", role: "SUPER_ADMIN", passwordHash } });
  console.log(`Super admin ready: ${email}`);

  for (const b of brands) {
    if (await prisma.brand.findUnique({ where: { slug: b.slug } })) continue;
    const { admin, products, ...data } = b;
    const brand = await prisma.brand.create({
      data: {
        ...data,
        currency: "PKR",
        users: { create: { email: admin, name: `${b.name} Admin`, role: "BRAND_ADMIN", passwordHash: await bcrypt.hash("Password123!", 10) } },
      },
    });
    const cats = {};
    for (const [, cat] of products) {
      if (!cats[cat])
        cats[cat] = await prisma.category.create({
          data: { brandId: brand.id, name: cat, slug: cat.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
        });
    }
    for (const [name, cat, price, rx] of products) {
      await prisma.product.create({
        data: {
          brandId: brand.id,
          categoryId: cats[cat].id,
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
          description: `${name} from ${b.name}. Always read the label and follow the directions for use.`,
          price,
          stock: 100,
          requiresRx: rx,
        },
      });
    }
    console.log(`Created brand ${b.slug}`);
  }
  console.log("Seed complete.");
}

main().finally(() => prisma.$disconnect());
