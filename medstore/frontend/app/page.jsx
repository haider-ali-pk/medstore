import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { Shield, Truck, Lock, Pill, Heart, Phone } from "@/components/Icons";
import { getBrand, sfetch, money } from "@/lib/server";
import BannerStrip from "@/components/BannerStrip";
export default async function Home() {
  const brand = await getBrand();
  const [products, categories] = await Promise.all([sfetch("/products?limit=8"), sfetch("/categories")]);

  const trust = [
    [Shield, "100% genuine", "Sourced only from licensed suppliers."],
    [Truck, "Fast delivery", brand.freeDeliveryOver != null ? `Free on orders over ${money(brand.freeDeliveryOver, brand.currency)}.` : "Straight to your door."],
    [Lock, "Secure ordering", "Cash on delivery or online payment."],
    [Phone, "Pharmacist support", "Questions? Call or WhatsApp us."],
  ];

  return (
    <div className="space-y-14">
           <BannerStrip />
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand to-accent text-white">
        <svg className="absolute -right-10 -top-10 h-80 w-80 text-white/10" viewBox="0 0 200 200" fill="currentColor" aria-hidden>
          <rect x="70" y="10" width="60" height="180" rx="14" />
          <rect x="10" y="70" width="180" height="60" rx="14" />
        </svg>
        <svg className="absolute -bottom-16 right-40 hidden h-56 w-56 text-white/10 lg:block" viewBox="0 0 200 200" fill="currentColor" aria-hidden>
          <circle cx="100" cy="100" r="90" />
        </svg>
        <div className="relative grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.3fr_1fr] lg:p-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold tracking-wide backdrop-blur">
              <Heart size={14} /> Your trusted online pharmacy
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              {brand.tagline || "Your health, delivered."}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
              Genuine medicines, medical devices and wellness essentials. Order online and pay in {brand.currency === "PKR" ? "Pakistani Rupees" : brand.currency} — cash on delivery available.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="btn bg-white !px-6 !py-3 text-brand hover:bg-slate-100">Shop now</Link>
              <Link href="/register" className="btn border border-white/50 !px-6 !py-3 text-white hover:bg-white/10">Create account</Link>
            </div>
          </div>
          <div className="hidden items-center justify-center lg:flex">
            <div className="grid w-full max-w-xs gap-3">
              {[["Genuine products", Pill], ["Licensed pharmacists", Shield], ["Doorstep delivery", Truck]].map(([t, I]) => (
                <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/15 p-4 backdrop-blur">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand"><I size={20} /></span>
                  <span className="font-semibold">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {trust.map(([I, t, d]) => (
          <div key={t} className="card flex items-start gap-3.5 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><I size={22} /></span>
            <div>
              <p className="font-bold text-slate-900">{t}</p>
              <p className="mt-0.5 text-sm text-slate-500">{d}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Categories */}
      {categories?.length > 0 && (
        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Shop by category</h2>
            <Link href="/products" className="text-sm font-semibold text-brand hover:underline">View all →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((c) => (
              <Link key={c.id} href={`/products?category=${c.slug}`} className="card group flex flex-col items-center gap-2 p-5 text-center transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lift">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white"><Pill size={24} /></span>
                <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                <span className="text-xs text-slate-400">{c._count?.products ?? 0} items</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Featured products</h2>
          <Link href="/products" className="text-sm font-semibold text-brand hover:underline">View all →</Link>
        </div>
        {products?.items?.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {products.items.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        ) : (
          <p className="card p-10 text-center text-slate-500">Products will appear here soon.</p>
        )}
      </section>

      {/* How it works */}
      <section className="card p-8 sm:p-10">
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-slate-900">How ordering works</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {[["1", "Choose your products", "Search or browse medicines, devices and vitamins."], ["2", "Place your order", "Enter your delivery address and pick how you want to pay."], ["3", "Receive at home", "We confirm and deliver to your door. Pay on delivery if you prefer."]].map(([n, t, d]) => (
            <div key={n} className="text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand text-lg font-extrabold text-white">{n}</span>
              <p className="mt-4 font-bold text-slate-900">{t}</p>
              <p className="mt-1 text-sm text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
