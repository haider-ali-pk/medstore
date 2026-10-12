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

      <div className="container-x flex items-center gap-2 py-2.5 sm:gap-3 sm:py-3">
        <button
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>

        <Link href="/" className="flex min-w-0 items-center gap-2 sm:shrink-0 sm:gap-2.5">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto max-w-[110px] object-contain sm:h-9 sm:max-w-[140px]" />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-lg font-black text-white">+</span>
          )}
          <span className="max-w-[110px] truncate text-base font-extrabold tracking-tight text-slate-900 sm:max-w-none sm:text-lg">{brand.name}</span>
        </Link>

        <form onSubmit={submit} className="relative mx-auto hidden max-w-xl flex-1 md:block">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !rounded-full !bg-slate-50 !pl-10" placeholder="Search medicines, devices, vitamins…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>

        <nav className="ml-auto flex shrink-0 items-center gap-1 text-sm font-medium">
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
              <Link href="/login" aria-label="Login" className="flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-slate-700 hover:bg-slate-100 sm:h-auto sm:px-3 sm:py-2">
                <User size={20} /> <span className="hidden sm:inline">Login</span>
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm hidden sm:inline-flex">Sign up</Link>
            </>
          )}
          <Link href="/cart" className="relative ml-0.5 grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-brand hover:text-brand sm:ml-1 sm:h-auto sm:w-auto sm:p-2.5" aria-label="Cart">
            <Cart size={20} />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">{cartCount}</span>
            )}
          </Link>
        </nav>
      </div>

      {/* mobile search: always visible under the header row */}
      <form onSubmit={submit} className="container-x relative pb-2.5 md:hidden">
        <Search size={18} className="pointer-events-none absolute left-7 top-[calc(50%-5px)] -translate-y-1/2 text-slate-400 sm:left-9" />
        <input className="input !rounded-full !bg-slate-50 !pl-10" placeholder="Search medicines, devices…" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>

      {/* category strip (desktop) */}
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
        <div className="max-h-[calc(100dvh-110px)] overflow-y-auto border-t border-slate-100 bg-white p-3 md:hidden">
          <div className="grid gap-1 text-base font-medium" onClick={() => setOpen(false)}>
            <Link href="/products" className="rounded-lg px-3 py-3 hover:bg-slate-100">All products</Link>
            {categories?.map((c) => (
              <Link key={c.id} href={`/products?category=${c.slug}`} className="rounded-lg px-3 py-3 text-slate-600 hover:bg-slate-100">{c.name}</Link>
            ))}
            <hr className="my-2" />
            {user ? (
              <>
                {isAdmin && <Link href="/admin" className="rounded-lg px-3 py-3 text-brand hover:bg-slate-100">Admin panel</Link>}
                <Link href="/orders" className="rounded-lg px-3 py-3 hover:bg-slate-100">My orders</Link>
                <button onClick={() => { logout(); router.push("/"); }} className="rounded-lg px-3 py-3 text-left text-slate-500 hover:bg-slate-100">Logout</button>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-3 hover:bg-slate-100">Login</Link>
                <Link href="/register" className="rounded-lg px-3 py-3 hover:bg-slate-100">Create account</Link>
              </>
            )}
            {brand.phone && (
              <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="mt-1 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-3 text-slate-700">
                <Phone size={16} /> Call us: {brand.phone}
              </a>
            )}
          </div>
        </div>
      )}
    </header>
  );
}