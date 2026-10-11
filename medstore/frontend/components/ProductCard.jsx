"use client";
import Link from "next/link";
import { useStore } from "./Providers";
import { Pill, Cart } from "./Icons";

export function ProductImage({ src, alt, className = "" }) {
  if (!src)
    return (
      <div className={`grid place-items-center bg-gradient-to-br from-brand/10 to-accent/10 text-brand/40 ${className}`}>
        <Pill size={44} />
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={`object-cover ${className}`} />;
}

export default function ProductCard({ p }) {
  const { addToCart, money } = useStore();
  const out = p.stock < 1;
  return (
    <div className="card group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <Link href={`/products/${p.slug}`} className="relative block aspect-square overflow-hidden bg-slate-100">
        <ProductImage src={p.imageUrl} alt={p.name} className="h-full w-full transition duration-300 group-hover:scale-105" />
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1">
          {p.requiresRx && <span className="badge bg-red-600 text-white">Rx</span>}
          {Number(p.comparePrice) > Number(p.price) && <span className="badge bg-emerald-600 text-white">{Math.round((1 - Number(p.price) / Number(p.comparePrice)) * 100)}% off</span>}
          {!out && p.stock <= 5 && <span className="badge bg-amber-500 text-white">Only {p.stock} left</span>}
        </div>
        {out && (
          <div className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-bold text-slate-700">Out of stock</div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {p.category && <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">{p.category.name}</span>}
        <Link href={`/products/${p.slug}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-900 hover:text-brand">{p.name}</Link>
        {p.genericName && <span className="line-clamp-1 text-xs text-slate-500">{p.genericName}</span>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="flex flex-col leading-tight">
            <span className="text-base font-extrabold text-slate-900">{money(p.price)}</span>
            {Number(p.comparePrice) > Number(p.price) && <span className="text-xs text-slate-400 line-through">{money(p.comparePrice)}</span>}
          </span>
          <button className="btn btn-primary btn-sm" disabled={out} onClick={() => addToCart(p)} aria-label={`Add ${p.name} to cart`}>
            <Cart size={15} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
