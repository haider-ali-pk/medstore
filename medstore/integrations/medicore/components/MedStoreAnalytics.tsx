"use client";
// MediCore  ->  components/MedStoreAnalytics.tsx
// Drop <MedStoreAnalytics /> anywhere on MediCore's super admin dashboard.
import { useEffect, useState } from "react";

type Brand = {
  slug: string; name: string;
  totals: { orders: number; revenue: number; customers: number; pending: number };
  today: { revenue: number; orders: number };
  topProducts: { name: string; qty: number; revenue: number }[];
};
type Data = {
  generatedAt: string;
  summary: { brands: number; orders: number; revenue: number; customers: number; pendingOrders: number; revenueToday: number };
  brands: Brand[];
};

const rs = (n: number) => "Rs " + Math.round(n).toLocaleString("en-PK");

export default function MedStoreAnalytics() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/integrations/medstore")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load MedStore data"))))
      .then(setD)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="rounded-xl border p-4 text-sm text-red-600">{err}</div>;
  if (!d) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;

  const cards: [string, string | number][] = [
    ["MedStore revenue", rs(d.summary.revenue)],
    ["Today", rs(d.summary.revenueToday)],
    ["Orders", d.summary.orders],
    ["Pending orders", d.summary.pendingOrders],
    ["Customers", d.summary.customers],
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">MedStore — online pharmacy sales</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([l, v]) => (
          <div key={l} className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">{l}</p>
            <p className="mt-1 text-xl font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr><th className="p-3">Store</th><th className="p-3">Orders</th><th className="p-3">Revenue</th><th className="p-3">Today</th><th className="p-3">Pending</th></tr>
          </thead>
          <tbody>
            {d.brands.map((b) => (
              <tr key={b.slug} className="border-t">
                <td className="p-3 font-medium">{b.name}</td>
                <td className="p-3">{b.totals.orders}</td>
                <td className="p-3">{rs(b.totals.revenue)}</td>
                <td className="p-3">{rs(b.today.revenue)}</td>
                <td className="p-3">{b.totals.pending}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Updated {new Date(d.generatedAt).toLocaleTimeString()}</p>
    </section>
  );
}
