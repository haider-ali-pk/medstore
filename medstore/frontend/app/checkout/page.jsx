// frontend/app/checkout/page.jsx   (REPLACE THE WHOLE FILE)
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Providers";
import { resize } from "@/components/ImageUpload";

const CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Hyderabad", "Sialkot", "Gujranwala", "Bahawalpur", "Sargodha", "Abbottabad"];

export default function Checkout() {
  const { brand, user, ready, cart, cartTotal, call, clearCart, money, notify } = useStore();
  const router = useRouter();
  const [f, setF] = useState({ shipName: "", shipPhone: "", shipAddress: "", shipCity: "", notes: "" });
  const first = brand.codEnabled ? "COD" : brand.walletEnabled ? "WALLET" : "CARD";
  const [pay, setPay] = useState(first);
  const [ref, setRef] = useState("");
  const [rx, setRx] = useState(""); // private path of the uploaded prescription
  const [rxName, setRxName] = useState("");
  const [rxBusy, setRxBusy] = useState(false);
  const [forceRx, setForceRx] = useState(false); // carts saved before this update do not know which items need Rx
  const rxInput = useRef(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (user) setF((x) => ({ ...x, shipName: x.shipName || user.name, shipPhone: x.shipPhone || user.phone || "" }));
  }, [user]);

  if (!ready) return null;
  if (!user)
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-extrabold">Log in to checkout</h1>
        <p className="mt-2 text-sm text-slate-500">Your cart will be kept.</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/login" className="btn btn-primary">Log in</Link>
          <Link href="/register" className="btn btn-outline">Sign up</Link>
        </div>
      </div>
    );
  if (!cart.length)
    return <p className="card p-8 text-center">Your cart is empty. <Link href="/products" className="font-semibold text-brand">Shop now</Link></p>;

  const free = brand.freeDeliveryOver;
  const fee = free != null && cartTotal >= free ? 0 : brand.deliveryFee || 0;
  const total = cartTotal + fee;
  const needsRx = forceRx || cart.some((i) => i.requiresRx);

  const methods = [
    brand.codEnabled && ["COD", "Cash on delivery", "Pay in cash when your order arrives."],
    brand.walletEnabled && ["WALLET", "JazzCash / Easypaisa / Bank transfer", "Pay now and enter your transaction ID."],
    brand.cardEnabled && ["CARD", "Debit / credit card", "Secure online card payment."],
  ].filter(Boolean);

  async function pickRx(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    setRxBusy(true);
    try {
      const dataUrl = await resize(file, 1400);
      const r = await call("/orders/prescription", { method: "POST", body: { dataUrl } });
      setRx(r.path);
      setRxName(file.name);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setRxBusy(false);
    }
  }

  async function place(e) {
    e.preventDefault();
    setErr("");
    if (needsRx && !rx) return setErr("Please upload a photo of the doctor's prescription.");
    setBusy(true);
    try {
      const r = await call("/orders", {
        method: "POST",
        body: {
          ...f,
          paymentMethod: pay,
          paymentRef: pay === "WALLET" ? ref : undefined,
          prescriptionPath: needsRx ? rx : undefined,
          items: cart.map((i) => ({ productId: i.id, quantity: i.quantity })),
        },
      });
      clearCart();
      if (r.checkoutUrl) window.location.href = r.checkoutUrl;
      else { notify("Order placed successfully"); router.push(`/orders/${r.order.id}`); }
    } catch (e2) {
      if (/prescription/i.test(e2.message)) setForceRx(true);
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={place} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Checkout</h1>
        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold">Delivery details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Full name</label><input className="input" required value={f.shipName} onChange={set("shipName")} autoComplete="name" /></div>
            <div><label className="label">Mobile / WhatsApp</label><input className="input" required inputMode="tel" placeholder="03XX XXXXXXX" value={f.shipPhone} onChange={set("shipPhone")} autoComplete="tel" /></div>
          </div>
          <div><label className="label">Full address</label><input className="input" required placeholder="House #, street, area / society" value={f.shipAddress} onChange={set("shipAddress")} autoComplete="street-address" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">City</label>
              <input className="input" required list="pk-cities" value={f.shipCity} onChange={set("shipCity")} />
              <datalist id="pk-cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div><label className="label">Notes (optional)</label><input className="input" placeholder="e.g. call before delivery" value={f.notes} onChange={set("notes")} /></div>
          </div>
        </section>

        {needsRx && (
          <section className="card space-y-3 p-6">
            <h2 className="text-lg font-bold">Prescription</h2>
            <p className="text-sm text-slate-500">Your cart has prescription medicine. Upload a clear photo of the doctor's prescription — our pharmacist will verify it before dispatch.</p>
            <input ref={rxInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pickRx} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-outline" disabled={rxBusy} onClick={() => rxInput.current?.click()}>
                {rxBusy ? "Uploading…" : rx ? "Replace photo" : "Upload prescription"}
              </button>
              {rx && <span className="text-sm font-medium text-emerald-700">✓ {rxName || "Uploaded"}</span>}
            </div>
          </section>
        )}

        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-bold">Payment method</h2>
          {methods.length === 0 && <p className="text-sm text-red-600">No payment method is enabled for this store yet.</p>}
          {methods.map(([id, title, desc]) => (
            <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${pay === id ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "border-slate-200 hover:border-slate-300"}`}>
              <input type="radio" className="mt-1 accent-[rgb(var(--brand))]" checked={pay === id} onChange={() => setPay(id)} />
              <span>
                <span className="block font-semibold text-slate-900">{title}</span>
                <span className="block text-sm text-slate-500">{desc}</span>
              </span>
            </label>
          ))}
          {pay === "WALLET" && (
            <div className="space-y-3 rounded-xl bg-amber-50 p-4 text-sm">
              <p className="text-amber-900">{brand.paymentInstructions || "Send the total amount to our account and enter the transaction ID below."}</p>
              <input className="input" placeholder="Transaction ID / reference" required value={ref} onChange={(e) => setRef(e.target.value)} />
              <p className="text-xs text-amber-800">Your order is confirmed after we verify the payment.</p>
            </div>
          )}
        </section>
      </div>

      <aside className="card h-fit space-y-3 p-6 lg:sticky lg:top-40">
        <h2 className="text-lg font-extrabold">Order summary</h2>
        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
          {cart.map((i) => (
            <div key={i.id} className="flex justify-between gap-3 text-sm"><span className="text-slate-600">{i.name} × {i.quantity}</span><span className="shrink-0 font-medium">{money(i.quantity * Number(i.price))}</span></div>
          ))}
        </div>
        <div className="space-y-2 border-t pt-3 text-sm">
          <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(cartTotal)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Delivery</span><span>{fee === 0 ? <b className="text-emerald-600">Free</b> : money(fee)}</span></div>
        </div>
        <div className="flex justify-between border-t pt-3 text-lg font-extrabold"><span>Total</span><span>{money(total)}</span></div>
        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <button className="btn btn-primary w-full !py-3" disabled={busy || rxBusy || methods.length === 0}>{busy ? "Placing order…" : `Place order · ${money(total)}`}</button>
      </aside>
    </form>
  );
}