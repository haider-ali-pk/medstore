// Messages to customers. Every channel is optional: it only runs when its env variables are set,
// and a failure here never breaks an order or a reset request.
const nodemailer = require("nodemailer");

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timed out")), ms))]);
const intl = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("0") ? "92" + d.slice(1) : d; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const mailReady = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
let transporter;
function mailer() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text, brandName }) {
  if (!mailReady()) throw new Error("Email is not set up (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  const name = String(brandName || "Store").replace(/["\r\n]/g, "");
  const html = esc(text).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  await withTimeout(
    mailer().sendMail({ from: `"${name}" <${process.env.MAIL_FROM || process.env.SMTP_USER}>`, to, subject, text, html: `<div style="font-family:sans-serif;line-height:1.55">${html}</div>` }),
    12000
  );
}

async function sendWhatsApp(phone, brandName, text) {
  const { WHATSAPP_TOKEN: token, WHATSAPP_PHONE_ID: id, WHATSAPP_TEMPLATE: tpl } = process.env;
  if (!token || !id || !tpl) return;
  const one = (s) => String(s).replace(/\s+/g, " ").trim(); // template variables cannot contain line breaks
  const res = await withTimeout(
    fetch(`https://graph.facebook.com/v20.0/${id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: intl(phone), type: "template",
        template: { name: tpl, language: { code: process.env.WHATSAPP_LANG || "en" }, components: [{ type: "body", parameters: [{ type: "text", text: one(brandName) }, { type: "text", text: one(text) }] }] },
      }),
    }),
    8000
  );
  if (!res.ok) throw new Error(`WhatsApp HTTP ${res.status}`);
}

async function sendSms(phone, text) {
  const { TWILIO_SID: sid, TWILIO_TOKEN: tok, TWILIO_FROM: from } = process.env;
  if (!sid || !tok || !from) return;
  const res = await withTimeout(
    fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: "+" + intl(phone), From: from, Body: text }),
    }),
    8000
  );
  if (!res.ok) throw new Error(`SMS HTTP ${res.status}`);
}

const ref = (o) => `MS-${String(o.orderNo).padStart(6, "0")}`;
const rs = (n) => "Rs " + Number(n || 0).toLocaleString("en-PK");

function messageFor(event, o, brand) {
  const pickup = o.fulfillment === "PICKUP";
  const where = o.pickupBranch ? ` at ${o.pickupBranch.name}` : "";
  if (event === "created")
    return { subject: `Order ${ref(o)} received`, text: `Thank you for your order ${ref(o)} at ${brand.name}. Total: ${rs(o.total)}. We will confirm it shortly.` };
  const s = {
    CONFIRMED: pickup ? `is confirmed and being prepared for pickup${where}.` : "is confirmed and being prepared.",
    SHIPPED: pickup ? `is ready for pickup${where}.` : "has been dispatched and is on its way.",
    DELIVERED: pickup ? "has been collected. Thank you for shopping with us!" : "has been delivered. Thank you for shopping with us!",
    CANCELLED: "has been cancelled. Please call us if you have any questions.",
  }[o.status];
  return s ? { subject: `Order ${ref(o)} update`, text: `Your order ${ref(o)} ${s}` } : null;
}

// event: "created" | "status".  order must include: user { email }, pickupBranch { name } (both optional)
async function notifyOrder(event, order, brand) {
  try {
    const m = messageFor(event, order, brand);
    if (!m) return;
    const jobs = [];
    if (mailReady() && order.user?.email)
      jobs.push(sendMail({ to: order.user.email, subject: `${m.subject} · ${brand.name}`, text: `${m.text}\n\n${brand.name}${brand.phone ? `\n${brand.phone}` : ""}`, brandName: brand.name }));
    jobs.push(sendWhatsApp(order.shipPhone, brand.name, m.text), sendSms(order.shipPhone, `${brand.name}: ${m.text}`));
    (await Promise.allSettled(jobs)).forEach((r) => r.status === "rejected" && console.warn("Customer notice failed:", r.reason?.message));
  } catch (e) {
    console.warn("Customer notice failed:", e.message);
  }
}

module.exports = { sendMail, notifyOrder };