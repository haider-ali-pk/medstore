"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Providers";
import { shortDate, orderRef } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export default function Orders() {
  const { user, ready, call, money } = useStore();
  const [orders, setOrders] = useState(null);
  useEffect(() => { if (user) call("/orders").then(setOrders).catch(() => setOrders([])); }, [user, call]);

  if (!ready) return null;
  if (!user) return <p className="card p-8 text-center">Please <Link href="/login" className="font-semibold text-brand">log in</Link> to see your orders.</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">My orders</h1>
      {orders === null && <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-20" />)}</div>}
      {orders?.length === 0 && (
        <div className="card p-10 text-center text-slate-500">No orders yet. <Link href="/products" className="font-semibold text-brand">Start shopping</Link></div>
      )}
      {orders?.map((o) => (
        <Link key={o.id} href={`/orders/${o.id}`} className="card flex items-center justify-between gap-4 p-4 transition hover:border-brand hover:shadow-lift">
          <div>
            <p className="font-bold">Order {orderRef(o)}</p>
            <p className="text-sm text-slate-500">{shortDate(o.createdAt)} · {o.items.length} item(s)</p>
          </div>
          <div className="text-right">
            <p className="font-extrabold">{money(o.total)}</p>
            <StatusBadge status={o.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}
