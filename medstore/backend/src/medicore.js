// backend/src/medicore.js
// Everything MedStore sends to MediCore.
// IMPORTANT: on Vercel the function is frozen the moment the response is sent, so a "fire and forget" request
// often never leaves. Callers must `await notifyMediCore(...)`. It never throws and gives up after 3 seconds,
// so a MediCore outage can never break a customer's checkout.
const crypto = require("crypto");

const orderPayload = (o, brand) => ({
  orderId: o.id,
  orderNo: o.orderNo,
  brand: { id: brand.id, slug: brand.slug, name: brand.name },
  status: o.status,
  paymentMethod: o.paymentMethod,
  paymentStatus: o.paymentStatus,
  currency: brand.currency,
  subtotal: Number(o.subtotal),
  deliveryFee: Number(o.deliveryFee),
  total: Number(o.total),
  city: o.shipCity,
  hasPrescription: !!o.prescriptionPath,
  items: (o.items || []).map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
  createdAt: o.createdAt,
});

async function notifyMediCore(type, payload) {
  const url = process.env.MEDICORE_WEBHOOK_URL;
  if (!url) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const body = JSON.stringify({ source: "medstore", type, sentAt: new Date().toISOString(), data: payload });
    const sig = crypto.createHmac("sha256", process.env.MEDICORE_WEBHOOK_SECRET || "").update(body).digest("hex");
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-medstore-signature": sig },
      body,
      signal: ctrl.signal,
    });
  } catch (e) {
    console.warn("MediCore push failed:", e.message);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { notifyMediCore, orderPayload };