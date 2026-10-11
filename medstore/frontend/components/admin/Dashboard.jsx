"use client";
import { useEffect, useState } from "react";
import BarChart from "../BarChart";
import { StatusBadge } from "../StatusBadge";
import { ProductImage } from "../ProductCard";
import { Alert } from "../Icons";

export default function Dashboard({ call, money, go }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { call("/admin/stats").then(setS).catch((e) => setErr(e.message)); }, [call]);

  if (err) return <p className="card p-6 text-red-600">{err}</p>;
  if (!s)
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28" />)}</div>
        <div className="skeleton h-64" />
      </div>
    );

  const cards = [
    ["Revenue (all time)", money(s.totals.revenue), `${money(s.periodRevenue)} in last 14 days`],
    ["Today's sales", money(s.today.revenue), `${s.today.orders} order${s.today.orders === 1 ? "" : "s"} today`],
    ["Orders", s.totals.orders, `${s.totals.pending} pending`],
    ["Customers", s.totals.customers, `${s.totals.products} active products`],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([l, v, sub]) => (
          <div key={l} className="card p-5">
            <p className="text-sm font-medium text-slate-500">{l}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{v}</p>
            <p className="mt-1 text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      {s.totals.pending > 0 && (
        <button onClick={() => go("orders")} className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900 hover:bg-amber-100">
          <Alert size={20} /> <span><b>{s.totals.pending} new order{s.totals.pending === 1 ? "" : "s"}</b> waiting for confirmation — click to review.</span>
        </button>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="card p-5">
          <h2 className="mb-4 font-bold">Revenue — last 14 days</h2>
          <BarChart data={s.series} money={money} />
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Orders by status</h2>
          <ul className="space-y-2.5 text-sm">
            {["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"].map((k) => (
              <li key={k} className="flex items-center justify-between"><StatusBadge status={k} /><b>{s.byStatus[k] || 0}</b></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Top products (14 days)</h2>
          {s.topProducts.length === 0 && <p className="text-sm text-slate-400">No sales yet.</p>}
          <ul className="divide-y">
            {s.topProducts.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium text-slate-800">{p.name}</span>
                <span className="shrink-0 text-slate-500">{p.qty} sold · <b className="text-slate-800">{money(p.revenue)}</b></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Low stock</h2>
            <button className="text-sm font-semibold text-brand" onClick={() => go("products")}>Manage →</button>
          </div>
          {s.lowStock.length === 0 && <p className="text-sm text-slate-400">All products are well stocked.</p>}
          <ul className="divide-y">
            {s.lowStock.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                <ProductImage src={p.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg" />
                <span className="flex-1 font-medium text-slate-800">{p.name}</span>
                <span className={`badge ${p.stock === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{p.stock === 0 ? "Out" : `${p.stock} left`}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
