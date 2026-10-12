const router = require("express").Router();
const { z } = require("zod");
const { prisma, resolveBrand, auth, bust, normalizePkPhone } = require("../lib");
const { notifyMediCore, orderPayload } = require("../medicore");
const { uploadPrivate } = require("../storage");

const stripe = process.env.STRIPE_SECRET_KEY ? require("stripe")(process.env.STRIPE_SECRET_KEY) : null;

router.use(resolveBrand);

const orderSchema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(99) })).min(1),
  paymentMethod: z.enum(["COD", "CARD", "WALLET"]),
  paymentRef: z.string().max(80).optional(),
  shipName: z.string().min(2, "Enter the receiver's name"),
  shipPhone: z.string().min(7, "Enter a valid phone number"),
  shipAddress: z.string().min(5, "Enter the full delivery address"),
  shipCity: z.string().min(2, "Enter your city"),
  notes: z.string().max(500).optional(),
  prescriptionPath: z.string().max(200).optional(),
});

// Place an order. Prices and delivery fee are always calculated on the server, never trusted from the client.
router.post("/", auth(), async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const data = parsed.data;
  const brand = req.brand;

  // A customer account belongs to ONE store; it cannot be used to order from another store.
  if (req.user.role === "CUSTOMER" && req.user.brandId !== brand.id) return res.status(403).json({ error: "Please log in to this store" });

  const phone = normalizePkPhone(data.shipPhone);
  if (!phone) return res.status(400).json({ error: "Enter a valid Pakistani mobile number, e.g. 0300 1234567" });

  if (data.paymentMethod === "COD" && !brand.codEnabled)
    return res.status(400).json({ error: "Cash on delivery is not available" });
  if (data.paymentMethod === "CARD" && (!brand.cardEnabled || !stripe))
    return res.status(400).json({ error: "Card payment is not available" });
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

  let subtotal = 0;
  const lines = [];
  for (const item of data.items) {
    const p = byId.get(item.productId);
    if (!p) return res.status(400).json({ error: "A product in your cart is no longer available" });
    if (p.stock < item.quantity) return res.status(400).json({ error: `Not enough stock for ${p.name}` });
    subtotal += Number(p.price) * item.quantity;
    lines.push({ productId: p.id, name: p.name, unitPrice: p.price, quantity: item.quantity });
  }

  const freeOver = brand.freeDeliveryOver == null ? null : Number(brand.freeDeliveryOver);
  const deliveryFee = freeOver !== null && subtotal >= freeOver ? 0 : Number(brand.deliveryFee || 0);
  const total = subtotal + deliveryFee;

  const order = await prisma
    .$transaction(async (tx) => {
      for (const l of lines) {
        const r = await tx.product.updateMany({
          where: { id: l.productId, stock: { gte: l.quantity } },
          data: { stock: { decrement: l.quantity } },
        });
        if (r.count === 0) throw new Error("STOCK");
      }
      return tx.order.create({
        data: {
          brandId: brand.id,
          userId: req.user.id,
          paymentMethod: data.paymentMethod,
          paymentRef: data.paymentRef?.trim() || null,
          subtotal,
          deliveryFee,
          total,
          shipName: data.shipName,
          shipPhone: phone,
          shipAddress: data.shipAddress,
          shipCity: data.shipCity,
                    notes: data.notes,
          prescriptionPath: needsRx ? data.prescriptionPath : null,
          items: { create: lines },
        },
        include: { items: true },
      });
    })
    .catch((e) => {
      if (e.message === "STOCK") return null;
      throw e;
    });

  if (!order) return res.status(400).json({ error: "An item just went out of stock" });
  bust(`pub:${brand.id}`); // stock changed -> refresh catalogue cache
  bust(`an:${brand.id}`);
  await notifyMediCore("order.created", orderPayload(order, brand));

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

router.get("/", auth(), async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id, brandId: req.brand.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(orders);
});

router.get("/:id", auth(), async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: req.user.id, brandId: req.brand.id },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

module.exports = router;
module.exports.orderPayload = orderPayload;
