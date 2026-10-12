"use client";
// frontend/components/SuperEditStore.jsx   (NEW FILE)
import { useState } from "react";

const TEXT = [
  ["name", "Store name"], ["domain", "Domain (e.g. shop.client.com)"], ["tagline", "Tagline"],
  ["phone", "Phone"], ["whatsapp", "WhatsApp (e.g. 923001234567)"], ["email", "Email"],
  ["address", "Address"], ["licenseNo", "Pharmacy licence no."], ["openingHours", "Opening hours"],
];
const PAGES = [
  ["termsText", "Terms & Conditions"], ["privacyText", "Privacy Policy"], ["returnPolicy", "Returns & Refund Policy"],
  ["shippingPolicy", "Shipping & Delivery Policy"], ["aboutText", "About us"],
];

export default function SuperEditStore({ brand, req, onClose, onSaved }) {
  const v = (k) => brand[k] || "";
  const [f, setF] = useState(() => ({
    name: v("name"), domain: v("domain"), tagline: v("tagline"), phone: v("phone"), whatsapp: v("whatsapp"), email: v("email"),
    address: v("address"), licenseNo: v("licenseNo"), openingHours: v("openingHours"),
    primaryColor: brand.primaryColor || "#0f766e", accentColor: brand.accentColor || "#0ea5e9",
    deliveryFee: Number(brand.deliveryFee || 0),
    freeDeliveryOver: brand.freeDeliveryOver == null ? "" : Number(brand.freeDeliveryOver),
    codEnabled: !!brand.codEnabled, walletEnabled: !!brand.walletEnabled, cardEnabled: !!brand.cardEnabled,
    paymentInstructions: v("paymentInstructions"),
    aboutText: v("aboutText"), termsText: v("termsText"), privacyText: v("privacyText"), returnPolicy: v("returnPolicy"), shippingPolicy: v("shippingPolicy"),
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await req(`/brands/${brand.id}`, {
        method: "PATCH",
        body: {
          ...f,
          domain: f.domain.trim() || null,
          deliveryFee: Number(f.deliveryFee || 0),
          freeDeliveryOver: f.freeDeliveryOver === "" ? null : Number(f.freeDeliveryOver),
        },
      });
      onSaved();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-900/50 p-4">
      <form onSubmit={save} className="card mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Edit store</h2>
            <p className="text-sm text-slate-500">{brand.name} · slug <code>{brand.slug}</code> (the slug cannot be changed)</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">✕</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {TEXT.map(([k, label]) => (
            <div key={k}><label className="label">{label}</label><input className="input" required={k === "name"} type={k === "email" ? "email" : "text"} value={f[k]} onChange={set(k)} /></div>
          ))}
        </div>
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">Main colour <input type="color" value={f.primaryColor} onChange={set("primaryColor")} /></label>
          <label className="flex items-center gap-2">Accent colour <input type="color" value={f.accentColor} onChange={set("accentColor")} /></label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Delivery charges (Rs)</label><input className="input" type="number" min="0" value={f.deliveryFee} onChange={set("deliveryFee")} /></div>
          <div><label className="label">Free delivery over (Rs)</label><input className="input" type="number" min="0" placeholder="empty = never free" value={f.freeDeliveryOver} onChange={set("freeDeliveryOver")} /></div>
        </div>

        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.codEnabled} onChange={set("codEnabled")} /> Cash on delivery</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.walletEnabled} onChange={set("walletEnabled")} /> JazzCash / Easypaisa / Bank transfer</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.cardEnabled} onChange={set("cardEnabled")} /> Online card payment</label>
          <div><label className="label">Payment instructions shown to customer</label><textarea className="input" rows={2} value={f.paymentInstructions} onChange={set("paymentInstructions")} /></div>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold">Website pages</h3>
          <p className="text-sm text-slate-500">Empty = standard professional text. Heading: “# Title”. Bullet: “- text”. Blank line = new paragraph.</p>
          {PAGES.map(([k, label]) => (
            <div key={k}><label className="label">{label}</label><textarea className="input font-mono text-xs" rows={6} value={f[k]} onChange={set(k)} placeholder="Empty = standard text" /></div>
          ))}
        </div>

        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary !px-8" disabled={busy}>{busy ? "Saving…" : "Save store"}</button>
        </div>
      </form>
    </div>
  );
}