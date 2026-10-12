"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Providers";
import Dashboard from "@/components/admin/Dashboard";
import Products from "@/components/admin/Products";
import Orders from "@/components/admin/Orders";
import Settings from "@/components/admin/Settings";
import Branches from "@/components/admin/Branches";
import Banners from "@/components/admin/Banners";
import Coupons from "@/components/admin/Coupons";
import { Chart, Box, List, Cog, Pin, Image as ImageIcon, Tag } from "@/components/Icons";

const TABS = [
  ["dashboard", "Dashboard", Chart],
  ["products", "Products", Box],
  ["orders", "Orders", List],
      ["branches", "Branches", Pin],
  ["banners", "Banners", ImageIcon],
  ["coupons", "Coupons", Tag],
  ["settings", "Settings", Cog],
];

export default function Admin() {
  const { brand, user, ready, call, money, notify } = useStore();
  const [tab, setTab] = useState("dashboard");

  if (!ready) return null;
  if (!user || user.role === "CUSTOMER")
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-extrabold">Admin access only</h1>
        <p className="mt-2 text-sm text-slate-500">Log in with your admin account to manage the store.</p>
        <Link href="/login" className="btn btn-primary mt-5">Log in</Link>
      </div>
    );

  const common = { call, money, notify };
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-40 lg:h-fit">
        <div className="mb-4 hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Admin panel</p>
          <p className="font-extrabold text-slate-900">{brand.name}</p>
          {user.role === "SUPER_ADMIN" && <span className="badge mt-1 bg-accent/10 text-accent">Super admin</span>}
        </div>
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
          {TABS.map(([id, label, I]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === id ? "bg-brand text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-brand lg:bg-transparent lg:ring-0 lg:hover:bg-white"}`}>
              <I size={18} /> {label}
            </button>
          ))}
          {user.role === "SUPER_ADMIN" && (
            <Link href="/super" className="flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-brand lg:ring-0">
              ⚙ Platform
            </Link>
          )}
        </nav>
      </aside>
      <section className="min-w-0">
        <h1 className="mb-5 text-2xl font-extrabold tracking-tight capitalize">{tab}</h1>
        {tab === "dashboard" && <Dashboard {...common} go={setTab} />}
        {tab === "products" && <ProductsTab {...common} />}
        {tab === "orders" && <Orders {...common} />}
                {tab === "branches" && <Branches call={call} notify={notify} />}
        {tab === "banners" && <Banners call={call} notify={notify} />}
        {tab === "coupons" && <Coupons {...common} />}
        {tab === "settings" && <Settings call={call} notify={notify} />}
      </section>
    </div>
  );
}

// Needs to know whether picture uploads are configured on the server.
function ProductsTab(props) {
  const [uploadsEnabled, setUploads] = useState(false);
  useEffect(() => { props.call("/admin/brand").then((b) => setUploads(!!b.uploadsEnabled)).catch(() => {}); }, [props.call]); // eslint-disable-line
  return <Products {...props} uploadsEnabled={uploadsEnabled} />;
}
