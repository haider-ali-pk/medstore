"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useStore } from "@/components/Providers";
import { StatusBadge } from "@/components/StatusBadge";
import { orderRef } from "@/lib/format";

const STEPS = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];
const PAY = { COD: "Cash on delivery", CARD: "Card", WALLET: "JazzCash / Easypaisa / Bank" };

function Detail() {
  const { id } = useParams();
  const sp = useSearchParams();
  const { user, ready, call, money } = useStore();
  const [o, setO] = useState(null);
  useEffect(() => { if (user) call(`/orders/${id}`).then(setO).catch(() => setO(false)); }, [user, id, call]);

  if (!ready) return null;
  if (!user) return <p className="card p-8 text-center">Please <Link href="/login" className="font-semibold text-brand">log in</Link>.</p>;
  if (o === false) return <p className="card p-8 text-center">Order not found.</p>;
  if (!o) return <div className="skeleton mx-auto h-72 max-w-2xl" />;
  const step = STEPS.indexOf(o.status);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {sp.get("paid") && <p className="rounded-xl bg-emerald-50 p-3.5 text-sm text-emerald-700">Payment received. Thank you!</p>}
      {sp.get("cancelled") && <p className="rounded-xl bg-amber-50 p-3.5 text-sm text-amber-700">Payment was cancelled. Contact us to complete your order.</p>}
      <div className="card space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold">Order {orderRef(o)}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{PAY[o.paymentMethod] || o.paymentMethod} · <StatusBadge status={o.paymentStatus} /></p>
          </div>
          <StatusBadge status={o.status} />
        </div>

        {o.status !== "CANCELLED" && (
          <ol className="flex items-center">
            {STEPS.map((s, i) => (
              <li key={s} className="flex flex-1 items-center last:flex-none">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i <= step ? "bg-brand text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span>
                {i < STEPS.length - 1 && <span className={`mx-1 h-1 flex-1 rounded ${i < step ? "bg-brand" : "bg-slate-200"}`} />}
              </li>
            ))}
          </ol>
        )}

        <ul className="divide-y">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between py-2.5 text-sm"><span>{i.name} × {i.quantity}</span><span className="font-medium">{money(i.quantity * Number(i.unitPrice))}</span></li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t pt-3 text-sm">
          <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(Number(o.total) - Number(o.deliveryFee || 0))}</span></div>
          <div className="flex justify-between text-slate-600"><span>Delivery</span><span>{Number(o.deliveryFee) ? money(o.deliveryFee) : "Free"}</span></div>
          <div className="flex justify-between pt-1 text-lg font-extrabold"><span>Total</span><span>{money(o.total)}</span></div>
        </div>
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          <b className="text-slate-800">Deliver to:</b> {o.shipName}, {o.shipAddress}, {o.shipCity} · {o.shipPhone}
        </p>
      </div>
      <Link href="/products" className="inline-block text-sm font-semibold text-brand">← Continue shopping</Link>
    </div>
  );
}

export default function OrderDetail() {
  return <Suspense fallback={<div className="skeleton mx-auto h-72 max-w-2xl" />}><Detail /></Suspense>;
}
