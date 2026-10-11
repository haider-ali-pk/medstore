"use client";
import Link from "next/link";
import { useStore } from "@/components/Providers";
import { ProductImage } from "@/components/ProductCard";
import { Cart as CartIcon, Minus, Plus, X, Truck } from "@/components/Icons";

export default function Cart() {
  const { brand, cart, cartTotal, setQty, removeFromCart, money } = useStore();

  if (!cart.length)
    return (
      <div className="card mx-auto max-w-lg p-12 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400"><CartIcon size={30} /></span>
        <h1 className="mt-4 text-xl font-extrabold">Your cart is empty</h1>
        <p className="mt-1 text-sm text-slate-500">Add some products to get started.</p>
        <Link href="/products" className="btn btn-primary mt-6">Browse products</Link>
      </div>
    );

  const free = brand.freeDeliveryOver;
  const fee = free != null && cartTotal >= free ? 0 : brand.deliveryFee || 0;
  const remaining = free != null ? Math.max(0, free - cartTotal) : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Your cart</h1>
        {free != null && (
          <div className="card p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Truck size={18} className="text-brand" />
              {remaining > 0 ? <>Add <b>{money(remaining)}</b> more for free delivery</> : <span className="text-emerald-600">You've unlocked free delivery 🎉</span>}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.min(100, (cartTotal / free) * 100)}%` }} />
            </div>
          </div>
        )}
        {cart.map((i) => (
          <div key={i.id} className="card flex items-center gap-4 p-4">
            <ProductImage src={i.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <Link href={`/products/${i.slug}`} className="line-clamp-2 font-semibold text-slate-900 hover:text-brand">{i.name}</Link>
              <p className="text-sm text-slate-500">{money(i.price)} each</p>
              <div className="mt-2 inline-flex items-center rounded-lg border border-slate-300 sm:hidden">
                <button className="px-2.5 py-1.5" onClick={() => setQty(i.id, i.quantity - 1)}><Minus size={14} /></button>
                <span className="w-7 text-center text-sm font-semibold">{i.quantity}</span>
                <button className="px-2.5 py-1.5" onClick={() => setQty(i.id, i.quantity + 1)}><Plus size={14} /></button>
              </div>
            </div>
            <div className="hidden items-center rounded-xl border border-slate-300 sm:flex">
              <button className="px-3 py-2 hover:text-brand" onClick={() => setQty(i.id, i.quantity - 1)} aria-label="Less"><Minus size={14} /></button>
              <span className="w-8 text-center text-sm font-semibold">{i.quantity}</span>
              <button className="px-3 py-2 hover:text-brand" onClick={() => setQty(i.id, i.quantity + 1)} aria-label="More"><Plus size={14} /></button>
            </div>
            <p className="w-24 text-right font-extrabold">{money(i.quantity * Number(i.price))}</p>
            <button className="text-slate-300 hover:text-red-600" onClick={() => removeFromCart(i.id)} aria-label="Remove"><X size={18} /></button>
          </div>
        ))}
      </div>
      <aside className="card h-fit space-y-3 p-6 lg:sticky lg:top-40">
        <h2 className="text-lg font-extrabold">Order summary</h2>
        <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{money(cartTotal)}</span></div>
        <div className="flex justify-between text-sm text-slate-600"><span>Delivery</span><span>{fee === 0 ? <b className="text-emerald-600">Free</b> : money(fee)}</span></div>
        <div className="flex justify-between border-t pt-4 text-lg font-extrabold"><span>Total</span><span>{money(cartTotal + fee)}</span></div>
        <Link href="/checkout" className="btn btn-primary w-full !py-3">Proceed to checkout</Link>
        <Link href="/products" className="block text-center text-sm font-medium text-slate-500 hover:text-brand">Continue shopping</Link>
      </aside>
    </div>
  );
}
