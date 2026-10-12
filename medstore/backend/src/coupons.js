const { prisma } = require("./lib");
const httpError = (status, message) => Object.assign(new Error(message), { status });

// Returns { coupon, discount } or throws a 400 with a message the customer can read.
async function priceCoupon(brandId, rawCode, subtotal) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { coupon: null, discount: 0 };
  const c = await prisma.coupon.findUnique({ where: { brandId_code: { brandId, code } } });
  if (!c || !c.isActive) throw httpError(400, "This coupon code is not valid");
  if (c.expiresAt && c.expiresAt < new Date()) throw httpError(400, "This coupon has expired");
  if (c.maxUses != null && c.usedCount >= c.maxUses) throw httpError(400, "This coupon has been fully used");
  if (c.minSubtotal != null && subtotal < Number(c.minSubtotal))
    throw httpError(400, `Add items worth Rs ${Number(c.minSubtotal).toLocaleString("en-PK")} or more to use this coupon`);
  let discount = c.type === "PERCENT" ? Math.round(subtotal * Number(c.value)) / 100 : Number(c.value);
  discount = Math.min(Math.round(discount * 100) / 100, subtotal);
  return { coupon: c, discount };
}

module.exports = { priceCoupon };