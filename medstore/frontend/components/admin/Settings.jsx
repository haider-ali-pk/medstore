"use client";
import { useEffect, useState } from "react";
import ImageUpload from "../ImageUpload";

// Defined OUTSIDE Settings on purpose: a component created inside another component is a "new" component on every
// keystroke, so React rebuilt the form and the text box lost focus after each character.
const Section = ({ title, children }) => (
  <section className="card space-y-4 p-6"><h2 className="text-lg font-bold">{title}</h2>{children}</section>
);

export default function Settings({ call, notify }) {
  const [f, setF] = useState(null);
  const [uploads, setUploads] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call("/admin/brand").then((b) => {
      setUploads(!!b.uploadsEnabled);
      setF({
        name: b.name || "", tagline: b.tagline || "", logoUrl: b.logoUrl || "", primaryColor: b.primaryColor, accentColor: b.accentColor,
        phone: b.phone || "", whatsapp: b.whatsapp || "", email: b.email || "", address: b.address || "", licenseNo: b.licenseNo || "", openingHours: b.openingHours || "",
        deliveryFee: Number(b.deliveryFee || 0), freeDeliveryOver: b.freeDeliveryOver == null ? "" : Number(b.freeDeliveryOver),
        codEnabled: b.codEnabled, walletEnabled: b.walletEnabled, cardEnabled: b.cardEnabled, paymentInstructions: b.paymentInstructions || "",
                aboutText: b.aboutText || "", termsText: b.termsText || "", privacyText: b.privacyText || "", returnPolicy: b.returnPolicy || "", shippingPolicy: b.shippingPolicy || "", gaId: b.gaId || "",
        aboutText: b.aboutText || "", termsText: b.termsText || "", privacyText: b.privacyText || "", returnPolicy: b.returnPolicy || "", shippingPolicy: b.shippingPolicy || "", gaId: b.gaId || "",
      });
    }).catch((e) => notify(e.message, "err"));
  }, [call, notify]);

  if (!f) return <div className="skeleton h-96" />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await call("/admin/brand", {
        method: "PUT",
        body: {
          ...f,
          logoUrl: f.logoUrl || null,
          deliveryFee: Number(f.deliveryFee || 0),
          freeDeliveryOver: f.freeDeliveryOver === "" ? null : Number(f.freeDeliveryOver),
        },
      });
      notify("Settings saved — changes show on the store within 1–2 minutes");
    } catch (e2) { notify(e2.message, "err"); }
    setBusy(false);
  }

 

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <Section title="Shop identity">
        <div><label className="label">Logo</label><ImageUpload value={f.logoUrl} onChange={(v) => setF({ ...f, logoUrl: v })} call={call} folder="logo" enabled={uploads} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Shop name</label><input className="input" required value={f.name} onChange={set("name")} /></div>
          <div><label className="label">Tagline</label><input className="input" value={f.tagline} onChange={set("tagline")} /></div>
        </div>
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">Main colour <input type="color" value={f.primaryColor} onChange={set("primaryColor")} /></label>
          <label className="flex items-center gap-2">Accent colour <input type="color" value={f.accentColor} onChange={set("accentColor")} /></label>
        </div>
      </Section>

      <Section title="Contact details (shown on the website)">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Phone</label><input className="input" placeholder="+92 300 1234567" value={f.phone} onChange={set("phone")} /></div>
          <div><label className="label">WhatsApp number</label><input className="input" placeholder="923001234567" value={f.whatsapp} onChange={set("whatsapp")} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={set("email")} /></div>
          <div><label className="label">Address</label><input className="input" value={f.address} onChange={set("address")} /></div>
          <div><label className="label">Pharmacy licence no. (DRAP)</label><input className="input" value={f.licenseNo} onChange={set("licenseNo")} /></div>
          <div><label className="label">Opening hours</label><input className="input" placeholder="Mon–Sat 9am–11pm" value={f.openingHours} onChange={set("openingHours")} /></div>
        </div>
      </Section>

      <Section title="Delivery (PKR)">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Delivery charges (Rs)</label><input className="input" type="number" min="0" value={f.deliveryFee} onChange={set("deliveryFee")} /></div>
          <div><label className="label">Free delivery over (Rs)</label><input className="input" type="number" min="0" placeholder="leave empty = never free" value={f.freeDeliveryOver} onChange={set("freeDeliveryOver")} /></div>
        </div>
      </Section>

      <Section title="Payment methods">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--brand))]" checked={f.codEnabled} onChange={set("codEnabled")} /> Cash on delivery</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--brand))]" checked={f.walletEnabled} onChange={set("walletEnabled")} /> JazzCash / Easypaisa / Bank transfer</label>
        {f.walletEnabled && (
          <div><label className="label">Payment instructions shown to customer</label><textarea className="input" rows={3} placeholder="JazzCash 0300-1234567 (Account title). Send the total and enter the transaction ID." value={f.paymentInstructions} onChange={set("paymentInstructions")} /></div>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--brand))]" checked={f.cardEnabled} onChange={set("cardEnabled")} /> Online card payment (needs a payment gateway key on the server)</label>
      </Section>
      <Section title="Website pages (About, Terms, Privacy, Returns, Delivery)">
        <p className="text-sm text-slate-500">Leave a box empty to show the built-in professional text. Type your own to replace it. Use "## " at the start of a line for a heading and "- " for a bullet point.</p>
        {[["aboutText", "About us"], ["termsText", "Terms & Conditions"], ["privacyText", "Privacy Policy"], ["returnPolicy", "Returns & Refunds"], ["shippingPolicy", "Delivery Policy"]].map(([k, label]) => (
          <div key={k}><label className="label">{label}</label><textarea className="input font-mono text-xs" rows={7} value={f[k]} onChange={set(k)} /></div>
        ))}
      </Section>
            <Section title="Google Analytics">
        <div><label className="label">Measurement ID (looks like G-XXXXXXXXXX)</label><input className="input" placeholder="G-XXXXXXXXXX" value={f.gaId} onChange={set("gaId")} /></div>
      </Section>
      <div className="flex justify-end"><button className="btn btn-primary !px-8 !py-3" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button></div>
    </form>
  );
}
