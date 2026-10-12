// frontend/components/admin/Orders.jsx   (REPLACE THE WHOLE FILE)
"use client";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "../StatusBadge";
import { Whatsapp } from "../Icons";
import { dateTime, orderRef } from "@/lib/format";

const STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
// Same rules as the server (backend/src/services.js): an order can only move to these statuses.
const NEXT = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PENDING", "SHIPPED", "CANCELLED"],
  SHIPPED: ["CONFIRMED", "DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};
const PAY = { COD: "Cash on delivery", CARD: "Card", WALLET: "JazzCash / Easypaisa / Bank" };
const wa = (phone, text = "") => `https://wa.me/${String(phone || "").replace(/\D/g, "").replace(/^0/, "92")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
const waText = (o) => {
  const pickup = o.fulfillment === "PICKUP";
  const s = { PENDING: "has been received", CONFIRMED: pickup ? "is confirmed and being prepared for pickup" : "is confirmed and being prepared", SHIPPED: pickup ? "is ready for pickup" : "has been dispatched and is on its way", DELIVERED: pickup ? "has been collected. Thank you!" : "has been delivered. Thank you!", CANCELLED: "has been cancelled" }[o.status];
  return `Hello ${o.shipName}, your order ${orderRef(o)} ${s}.`;
};

export default function Orders({ call, money, notify }) {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const load = useCallback(() => call("/admin/orders").then(setOrders).catch((e) => notify(e.message, "err")), [call, notify]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]); // new orders appear by themselves

  async function patch(id, body) {
    try { await call(`/admin/orders/${id}`, { method: "PATCH", body }); notify("Order updated"); load(); }
    catch (e) { notify(e.message, "err"); }
  }

  async function openRx(id) {
    const w = window.open("", "_blank"); // opened first so the browser does not block the pop-up
    try {
      const r = await call(`/admin/orders/${id}/prescription`);
      if (w) { w.opener = null; w.location.href = r.url; }
    } catch (e) { w?.close(); notify(e.message, "err"); }
  }

  if (!orders) return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div>;
  const shown = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["ALL", ...STATUSES].map((s) => {
          const n = s === "ALL" ? orders.length : orders.filter((o) => o.status === s).length;
          return (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${filter === s ? "bg-brand text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} ({n})
            </button>
          );
        })}
      </div>

      {shown.length === 0 && <p className="card p-10 text-center text-slate-400">No orders here.</p>}
      {shown.map((o) => (
        <div key={o.id} className="card space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold">{orderRef(o)} · {o.shipName}</p>
              <p className="text-xs text-slate-500">{dateTime(o.createdAt)} · {o.user?.email}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold">{money(o.total)}</p>
              {Number(o.deliveryFee) > 0 && <p className="text-xs text-slate-400">incl. {money(o.deliveryFee)} delivery</p>}
            </div>
          </div>
          <p className="text-sm text-slate-700">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</p>
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {o.fulfillment === "PICKUP" && <b>PICKUP · </b>}{o.shipAddress}, {o.shipCity} · {o.shipPhone}
            {Number(o.discount) > 0 && <><br /><b>Coupon {o.couponCode}: -{money(o.discount)}</b></>}
            {o.notes && <><br /><i>Note: {o.notes}</i></>}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <select className="input !w-auto !py-1.5" value={o.status} onChange={(e) => patch(o.id, { status: e.target.value })} disabled={NEXT[o.status].length === 0}>
              {[o.status, ...NEXT[o.status]].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
            </select>
            <span className="text-slate-500">{PAY[o.paymentMethod] || o.paymentMethod}</span>
            <StatusBadge status={o.paymentStatus} />
            {o.paymentRef && <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">Txn: <b>{o.paymentRef}</b></span>}
            {o.paymentStatus !== "PAID" && o.status !== "CANCELLED" && <button className="btn btn-outline btn-sm" onClick={() => patch(o.id, { paymentStatus: "PAID" })}>Mark paid</button>}
            {o.hasPrescription && <button className="btn btn-outline btn-sm !border-red-300 !text-red-700" onClick={() => openRx(o.id)}>View prescription</button>}
            <a href={wa(o.shipPhone, waText(o))} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[#128C7E] hover:underline">
              <Whatsapp size={16} /> WhatsApp customer
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}