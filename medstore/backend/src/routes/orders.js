const router = require("express").Router();
const { z } = require("zod");
const { prisma, resolveBrand, auth, bust, normalizePkPhone } = require("../lib");
const { notifyMediCore, orderPayload } = require("../medicore");
const { uploadPrivate } = require("../storage");
const { priceCoupon } = require("../coupons");
const { notifyOrder } = require("../notify");
const svc = require("../services");

const stripe = process.env.STRIPE_SECRET_KEY ? require("stripe")(process.env.STRIPE_SECRET_KEY) : null;

router.use(resolveBrand);

const orderSchema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(99) })).min(1),
  paymentMethod: z.enum(["COD", "CARD", "WALLET"]),
  paymentRef: z.string().max(80).optional(),
  fulfillment: z.enum(["DELIVERY", "PICKUP"]).default("DELIVERY"),
  pickupBranchId: z.string().optional(),
  couponCode: z.string().max(30).optional(),
  shipName: z.string().min(2, "Enter the receiver's name"),
  shipPhone: z.string().min(7, "Enter a valid phone number"),
  shipAddress: z.string().max(250).optional(),
  shipCity: z.string().max(60).optional(),
  notes: z.string().max(500).optional(),
  prescriptionPath: z.string().max(200).optional(),
});

// Place an order. Prices, discount and delivery fee are always calculated on the server, never trusted from the client.
router.post("/", auth(), async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const data = parsed.data;
  const brand = req.brand;
  const pickup = data.fulfillment === "PICKUP";

  // A customer account belongs to ONE store; it cannot be used to order from another store.
  if (req.user.role === "CUSTOMER" && req.user.brandId !== brand.id) return res.status(403).json({ error: "Please log in to this store" });

  const phone = normalizePkPhone(data.shipPhone);
  if (!phone) return res.status(400).json({ error: "Enter a valid Pakistani mobile number, e.g. 0300 1234567" });

  if (!pickup) {
    if (!data.shipAddress || data.shipAddress.trim().length < 5) return res.status(400).json({ error: "Enter the full delivery address" });
    if (!data.shipCity || data.shipCity.trim().length < 2) return res.status(400).json({ error: "Enter your city" });
  }

  if (data.paymentMethod === "COD" && !brand.codEnabled) return res.status(400).json({ error: "Cash on delivery is not available" });
  if (data.paymentMethod === "CARD" && (!brand.cardEnabled || !stripe)) return res.status(400).json({ error: "Card payment is not available" });
  if (data.paymentMethod === "WALLET") {
    if (!brand.walletEnabled) return res.status(400).json({ error: "This payment method is not available" });
    if (!data.paymentRef || data.paymentRef.trim().length < 4)
      return res.status(400).json({ error: "Enter your payment transaction ID so we can verify it" });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: data.items.map((i) => i.productId) }, brandId: brand.id, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // Prescription medicines can only be sold against a prescription (DRAP rule) -> customer uploads a photo at checkout.
  const needsRx = products.some((p) => p.requiresRx);
  if (needsRx && !data.prescriptionPath?.startsWith(`prescriptions/${req.user.id}/`))
    return res.status(400).json({ error: "Your cart has prescription medicine. Please upload a clear photo of the prescription." });

  let branch = null;
  let branchStock = new Map();
  if (pickup) {
    branch = data.pickupBranchId ? await prisma.branch.findFirst({ where: { id: data.pickupBranchId, brandId: brand.id, isActive: true } }) : null;
    if (!branch) return res.status(400).json({ error: "Choose the branch you will collect from" });
    const rows = await prisma.branchStock.findMany({ where: { branchId: branch.id, productId: { in: products.map((p) => p.id) } } });
    branchStock = new Map(rows.map((r) => [r.productId, r.stock]));
  }

  let subtotal = 0;
  const lines = [];
  for (const item of data.items) {
    const p = byId.get(item.productId);
    if (!p) return res.status(400).json({ error: "A product in your cart is no longer available" });
    if (pickup) {
      if ((branchStock.get(p.id) ?? 0) < item.quantity) return res.status(400).json({ error: `${p.name} is not available in enough quantity at ${branch.name}` });
    } else if (p.stock < item.quantity) return res.status(400).json({ error: `Not enough stock for ${p.name}` });
    subtotal += Number(p.price) * item.quantity;
    lines.push({ productId: p.id, name: p.name, unitPrice: p.price, quantity: item.quantity });
  }

  const { coupon, discount } = await priceCoupon(brand.id, data.couponCode, subtotal);
  if (coupon && data.paymentMethod === "CARD") return res.status(400).json({ error: "Coupons cannot be used with card payment yet. Choose another payment method." });

  const freeOver = brand.freeDeliveryOver == null ? null : Number(brand.freeDeliveryOver);
  const deliveryFee = pickup ? 0 : freeOver !== null && subtotal >= freeOver ? 0 : Number(brand.deliveryFee || 0);
  const total = Math.max(0, subtotal - discount + deliveryFee);

  const order = await prisma
    .$transaction(async (tx) => {
      for (const l of lines) {
        const r = pickup
          ? await tx.branchStock.updateMany({ where: { branchId: branch.id, productId: l.productId, stock: { gte: l.quantity } }, data: { stock: { decrement: l.quantity } } })
          : await tx.product.updateMany({ where: { id: l.productId, stock: { gte: l.quantity } }, data: { stock: { decrement: l.quantity } } });
        if (r.count === 0) throw new Error("STOCK");
      }
      if (coupon) {
        const r = await tx.coupon.updateMany({
          where: { id: coupon.id, isActive: true, ...(coupon.maxUses != null ? { usedCount: { lt: coupon.maxUses } } : {}) },
          data: { usedCount: { increment: 1 } },
        });
        if (r.count === 0) throw new Error("COUPON");
      }
      return tx.order.create({
        data: {
          brandId: brand.id,
          userId: req.user.id,
          paymentMethod: data.paymentMethod,
          paymentRef: data.paymentRef?.trim() || null,
          fulfillment: pickup ? "PICKUP" : "DELIVERY",
          pickupBranchId: pickup ? branch.id : null,
          couponCode: coupon ? coupon.code : null,
          discount,
          subtotal,
          deliveryFee,
          total,
          shipName: data.shipName,
          shipPhone: phone,
          shipAddress: pickup ? `Pickup: ${branch.name}, ${branch.address}` : data.shipAddress,
          shipCity: pickup ? branch.city || branch.name : data.shipCity,
          notes: data.notes,
          prescriptionPath: needsRx ? data.prescriptionPath : null,
          items: { create: lines },
        },
        include: { items: true },
      });
    })
    .catch((e) => {
      if (e.message === "STOCK") return "STOCK";
      if (e.message === "COUPON") return "COUPON";
      throw e;
    });

  if (order === "STOCK") return res.status(400).json({ error: "An item just went out of stock" });
  if (order === "COUPON") return res.status(400).json({ error: "That coupon is no longer available" });

  bust(`pub:${brand.id}`); // stock changed -> refresh catalogue cache
  bust(`an:${brand.id}`);
  await notifyMediCore("order.created", orderPayload(order, brand));
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
  await notifyOrder("created", { ...order, user: me, pickupBranch: branch }, brand);

  if (data.paymentMethod === "CARD") {
    const front = (process.env.FRONTEND_URL || "http://localhost:3000").split(",")[0].trim();
    const cur = brand.currency.toLowerCase();
    const line_items = order.items.map((i) => ({
      quantity: i.quantity,
      price_data: { currency: cur, unit_amount: Math.round(Number(i.unitPrice) * 100), product_data: { name: i.name } },
    }));
    if (deliveryFee > 0)
      line_items.push({ quantity: 1, price_data: { currency: cur, unit_amount: Math.round(deliveryFee * 100), product_data: { name: "Delivery" } } });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      metadata: { orderId: order.id },
      success_url: `${front}/orders/${order.id}?paid=1`,
      cancel_url: `${front}/orders/${order.id}?cancelled=1`,
    });
    await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
    return res.status(201).json({ order, checkoutUrl: session.url });
  }

  res.status(201).json({ order });
});

// Customer uploads a prescription photo (resized in the browser). Stored in a PRIVATE bucket; returns its path.
router.post("/prescription", auth(), async (req, res) => {
  const path = await uploadPrivate(req.body?.dataUrl, `prescriptions/${req.user.id}`);
  res.status(201).json({ path });
});

const withBranch = { items: true, pickupBranch: { select: { name: true, address: true, phone: true } } };

router.get("/", auth(), async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id, brandId: req.brand.id },
    include: withBranch,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(orders);
});

// Customer cancels their own order while it is still pending and nothing has been paid
router.post("/:id/cancel", auth(), async (req, res) => {
  const o = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user.id, brandId: req.brand.id } });
  if (!o) return res.status(404).json({ error: "Order not found" });
  if (o.status !== "PENDING") return res.status(400).json({ error: "Only pending orders can be cancelled. Please call us for help." });
  if (o.paymentStatus === "PAID" || (o.paymentMethod !== "COD" && o.paymentRef))
    return res.status(400).json({ error: "This order has a payment on it. Please contact us to cancel and arrange a refund." });
  await svc.updateOrder(req.brand, o.id, { status: "CANCELLED" });
  res.json({ ok: true });
});

router.get("/:id", auth(), async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: req.user.id, brandId: req.brand.id },
    include: withBranch,
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

module.exports = router;
module.exports.orderPayload = orderPayload;