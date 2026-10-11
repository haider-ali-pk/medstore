// One-time helper for an EXISTING database that was created in USD.
//   node prisma/to-pkr.js              -> only switches every brand's currency to PKR and removes demo picsum pictures
//   node prisma/to-pkr.js --convert    -> ALSO multiplies product prices by 280 (only do this if prices are still USD demo values)
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: require("../src/dburl")() } } });

(async () => {
  const convert = process.argv.includes("--convert");
  const rate = Number(process.argv.find((a) => a.startsWith("--rate="))?.split("=")[1] || 280);
  const b = await prisma.brand.updateMany({ where: { currency: { not: "PKR" } }, data: { currency: "PKR" } });
  console.log(`Brands switched to PKR: ${b.count}`);
  const imgs = await prisma.product.updateMany({ where: { imageUrl: { contains: "picsum.photos" } }, data: { imageUrl: null } });
  console.log(`Demo picsum pictures removed: ${imgs.count}`);
  if (convert) {
    const products = await prisma.product.findMany({ select: { id: true, price: true } });
    for (const p of products) {
      const rs = Math.max(5, Math.round((Number(p.price) * rate) / 5) * 5);
      await prisma.product.update({ where: { id: p.id }, data: { price: rs } });
    }
    console.log(`Prices converted x${rate}: ${products.length}`);
  }
})().finally(() => prisma.$disconnect());
