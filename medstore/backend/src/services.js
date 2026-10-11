// backend/src/services.js   (NEW FILE)
// Business rules shared by the store admin (/api/admin) AND MediCore (/api/integration),
// so a price / stock / order change behaves the same no matter where it was made.
const crypto = require("crypto");
const { z } = require("zod");
const { prisma, slugify, bust } = require("./lib");
const { notifyMediCore, orderPayload } = require("./medicore");

const httpError = (status, message) => Object.assign(new Error(message), { status });
const afterChange = (brandId) => { bust(`pub:${brandId}`); bust(`an:${brandId}`); bust("brand:"); };
const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === "" ? null : v]));

/* ---------------- products ---------------- */
const optText = (max) => z.string().max(max).optional().nullable().or(z.literal(""));
const productSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  description: z.string().max(5000).optional(),
  price: z.coerce.number().positive("Price must be greater than 0").max(10_000_000),
  comparePrice: z.coerce.number().positive().max(10_000_000).optional().nullable().or(z.literal("")),
  stock: z.coerce.number().int().min(0),
  sku: optText(60),
  genericName: optText(120),
  manufacturer: optText(120),
  externalId: optText(80), // id of the same item in MediCore's pharmacy inventory
  imageUrl: z.string().url("Image must be a valid URL").optional().nullable().or(z.literal("")),
  categoryId: z.string().optional().nullable().or(z.literal("")),
  requiresRx: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const parse = (schema, body) => {
  const r = schema.safeParse(body);
  if (!r.success) throw httpError(400, r.error.issues[0].message);
  return r.data;
};

async function checkCategory(brandId, categoryId) {
  if (categoryId && !(await prisma.category.findFirst({ where: { id: categoryId, brandId } })))
    throw httpError(400, "That category does not belong to this store");
}

async function createProduct(brand, body) {
  const data = parse(productSchema, body);
  await checkCategory(brand.id, data.categoryId);
  const slug = slugify(data.name) + "-" + crypto.randomBytes(2).toString("hex");
  const p = await prisma.product.create({ data: { ...clean(data), slug, brandId: brand.id } });
  afterChange(brand.id);
  return p;
}

async function updateProduct(brand, id, body) {
  const data = parse(productSchema.partial(), body);
  await checkCategory(brand.id, data.categoryId);
  const r = await prisma.product.updateMany({ where: { id, brandId: brand.id }, data: clean(data) });
  if (!r.count) throw httpError(404, "Product not found");
  afterChange(brand.id);
  return { ok: true };
}

// Set an exact stock number, or add/remove with delta (e.g. -3 when 3 units are sold at the MediCore counter).
async function adjustStock(brand, id, { stock, delta } = {}) {
  let r;
  if (stock !== undefined) {
    if (!Number.isInteger(stock) || stock < 0) throw httpError(400, "Stock must be a whole number, 0 or more");
    r = await prisma.product.updateMany({ where: { id, brandId: brand.id }, data: { stock } });
  } else if (Number.isInteger(delta)) {
    r = await prisma.product.updateMany({
      where: { id, brandId: brand.id, stock: { gte: Math.max(0, -delta) } },
      data: { stock: { increment: delta } },
    });
    if (!r.count && (await prisma.product.findFirst({ where: { id, brandId: brand.id } })))
      throw httpError(400, "Not enough stock for that change");
  } else throw httpError(400, "Send { stock } or { delta }");
  if (!r.count) throw httpError(404, "Product not found");
  afterChange(brand.id);
  return prisma.product.findUnique({ where: { id }, select: { id: true, stock: true } });
}

async function deleteProduct(brand, id) {
  // Products that were ordered are only hidden (order history stays intact); never-ordered ones are removed.
  const used = await prisma.orderItem.count({ where: { productId: id } });
  if (used) await prisma.product.updateMany({ where: { id, brandId: brand.id }, data: { isActive: false } });
  else await prisma.product.deleteMany({ where: { id, brandId: brand.id } });
  afterChange(brand.id);
  return { ok: true, hidden: !!used };
}

// MediCore -> MedStore catalogue sync. Matches on externalId; updates what you send, creates when missing.
async function syncProducts(brand, items) {
  const out = { created: 0, updated: 0, failed: [] };
  for (const raw of items) {
    try {
      const externalId = String(raw.externalId || "").trim();
      if (!externalId) throw new Error("externalId missing");
      const found = await prisma.product.findFirst({ where: { brandId: brand.id, externalId } });
      if (found) { await updateProduct(brand, found.id, { ...raw, externalId }); out.updated++; }
      else { await createProduct(brand, { ...raw, externalId }); out.created++; }
    } catch (e) { out.failed.push({ externalId: raw.externalId, error: e.message }); }
  }
  return out;
}

/* ---------------- orders ---------------- */
const STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
const PAYMENT = ["UNPAID", "PAID", "FAILED"];
// Allowed moves. A cancelled or delivered order is final (cancelling returns the stock exactly once).
const NEXT = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PENDING", "SHIPPED", "CANCELLED"],
  SHIPPED: ["CONFIRMED", "DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

async function updateOrder(brand, orderId, input = {}) {
  const before = await prisma.order.findFirst({ where: { id: orderId, brandId: brand.id }, include: { items: true } });
  if (!before) throw httpError(404, "Order not found");

  const data = {};
  if (input.status && input.status !== before.status) {
    if (!STATUSES.includes(input.status)) throw httpError(400, "Invalid status");
    if (!NEXT[before.status].includes(input.status))
      throw httpError(400, `An order that is ${before.status.toLowerCase()} cannot be changed to ${input.status.toLowerCase()}`);
    data.status = input.status;
    if (input.status === "DELIVERED" && before.paymentMethod === "COD") data.paymentStatus = "PAID"; // cash collected by the rider
  }
  if (input.paymentStatus && PAYMENT.includes(input.paymentStatus) && input.paymentStatus !== before.paymentStatus) {
    if (before.status === "CANCELLED" || data.status === "CANCELLED") throw httpError(400, "This order is cancelled");
    data.paymentStatus = data.paymentStatus || input.paymentStatus;
  }
  if (!Object.keys(data).length) return before;

  const order = await prisma.$transaction(async (tx) => {
    if (data.status === "CANCELLED")
      for (const i of before.items) await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
    return tx.order.update({ where: { id: before.id }, data, include: { items: true } });
  });
  afterChange(brand.id);
  await notifyMediCore("order.updated", orderPayload(order, brand));
  return order;
}

module.exports = {
  httpError, afterChange, clean, productSchema,
  createProduct, updateProduct, adjustStock, deleteProduct, syncProducts, updateOrder, STATUSES, NEXT,
};