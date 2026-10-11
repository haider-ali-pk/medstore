require("dotenv").config();
require("./asyncErrors");
process.on("unhandledRejection", (e) => console.error("Unhandled rejection:", e && e.message));
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const { prisma } = require("./lib");

const app = express();
const stripe = process.env.STRIPE_SECRET_KEY ? require("stripe")(process.env.STRIPE_SECRET_KEY) : null;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(compression());
app.use(cors({ origin: true, credentials: true }));

// Stripe webhook needs the raw body, so it is registered BEFORE express.json().
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) return res.status(404).end();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook error: ${e.message}`);
  }
  if (event.type === "checkout.session.completed") {
    const orderId = event.data.object.metadata?.orderId;
    if (orderId) {
      await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", status: "CONFIRMED" } });
    }
  }
  res.json({ received: true });
});

// Larger limit: product pictures are uploaded as (browser-resized) data URLs.
app.use(express.json({ limit: "6mb" }));

const { adminRouter, superRouter } = require("./routes/admin");
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/super", superRouter);
app.use("/api/admin", adminRouter);
app.use("/api/integration", require("./routes/integration")); // must be before the public router
app.use("/api/orders", require("./routes/orders"));
app.use("/api", require("./routes/public"));

app.use((err, _req, res, _next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

// Vercel imports the app; locally / on Render / Railway we start a server.
if (!process.env.VERCEL) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`API running on http://localhost:${port}`));
}

module.exports = app;
