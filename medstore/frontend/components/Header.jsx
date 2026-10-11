"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "./Providers";
import { Cart, Search, User, Menu, X, Phone, Truck } from "./Icons";

export default function Header() {
  const { brand, user, cartCount, logout, categories, money } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const isAdmin = user && (user.role === "BRAND_ADMIN" || user.role === "SUPER_ADMIN");

  const submit = (e) => {
    e.preventDefault();
    setOpen(false);
    router.push(`/products?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgb(226_232_240)]">
      {/* top info bar */}
      <div className="hidden bg-brand text-xs text-white sm:block">
        <div className="container-x flex items-center justify-between py-1.5">
          <span className="flex items-center gap-1.5">
            <Truck size={14} />
            {brand.freeDeliveryOver != null ? `Free delivery on orders over ${money(brand.freeDeliveryOver)}` : "Fast home delivery"}
          </span>
          {brand.phone && (
            <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:underline">
              <Phone size={14} /> {brand.phone}
            </a>
          )}
        </div>
      </div>

      <div className="container-x flex items-center gap-3 py-3">
        <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.name} className="h-9 w-auto max-w-[140px] object-contain" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-black text-white">+</span>
          )}
          <span className="hidden text-lg font-extrabold tracking-tight text-slate-900 sm:inline">{brand.name}</span>
        </Link>

        <form onSubmit={submit} className="relative mx-auto hidden max-w-xl flex-1 md:block">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !rounded-full !bg-slate-50 !pl-10" placeholder="Search medicines, devices, vitamins…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>

        <nav className="ml-auto flex items-center gap-1 text-sm font-medium">
          {user ? (
            <>
              {isAdmin && <Link href="/admin" className="btn btn-sm btn-accent hidden sm:inline-flex">Admin panel</Link>}
              <Link href="/orders" className="hidden rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 sm:block">My orders</Link>
              <button onClick={() => { logout(); router.push("/"); }} className="hidden rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 sm:block">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100">
                <User size={18} /> <span className="hidden sm:inline">Login</span>
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm hidden sm:inline-flex">Sign up</Link>
            </>
          )}
          <Link href="/cart" className="relative ml-1 rounded-xl border border-slate-200 p-2.5 text-slate-700 transition hover:border-brand hover:text-brand" aria-label="Cart">
            <Cart size={20} />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">{cartCount}</span>
            )}
          </Link>
        </nav>
      </div>

      {/* category strip */}
      {categories?.length > 0 && (
        <div className="hidden border-t border-slate-100 md:block">
          <div className="container-x flex items-center gap-1 overflow-x-auto py-1.5 text-sm">
            <Link href="/products" className="whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 hover:text-brand">All products</Link>
            {categories.map((c) => (
              <Link key={c.id} href={`/products?category=${c.slug}`} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-brand">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* mobile drawer */}
      {open && (
        <div className="border-t border-slate-100 bg-white p-4 md:hidden">
          <form onSubmit={submit} className="mb-3">
            <input className="input" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="grid gap-1 text-sm font-medium" onClick={() => setOpen(false)}>
            <Link href="/products" className="rounded-lg px-3 py-2 hover:bg-slate-100">All products</Link>
            {categories?.map((c) => (
              <Link key={c.id} href={`/products?category=${c.slug}`} className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">{c.name}</Link>
            ))}
            <hr className="my-2" />
            {user ? (
              <>
                {isAdmin && <Link href="/admin" className="rounded-lg px-3 py-2 text-brand hover:bg-slate-100">Admin panel</Link>}
                <Link href="/orders" className="rounded-lg px-3 py-2 hover:bg-slate-100">My orders</Link>
                <button onClick={() => { logout(); router.push("/"); }} className="rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100">Logout</button>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-slate-100">Login</Link>
                <Link href="/register" className="rounded-lg px-3 py-2 hover:bg-slate-100">Create account</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
