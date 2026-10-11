"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "./Providers";
import { Minus, Plus, Cart } from "./Icons";

export default function AddToCart({ product }) {
  const { addToCart } = useStore();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const out = product.stock < 1;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-xl border border-slate-300 bg-white">
          <button className="p-3 text-slate-600 hover:text-brand" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Less"><Minus size={16} /></button>
          <span className="w-10 text-center text-sm font-bold">{qty}</span>
          <button className="p-3 text-slate-600 hover:text-brand" onClick={() => setQty(Math.min(product.stock || 1, qty + 1))} aria-label="More"><Plus size={16} /></button>
        </div>
        <button className="btn btn-primary flex-1 !py-3" disabled={out} onClick={() => addToCart(product, qty)}>
          <Cart size={18} /> {out ? "Out of stock" : "Add to cart"}
        </button>
      </div>
      {!out && (
        <button className="btn btn-outline w-full !py-3" onClick={() => { addToCart(product, qty); router.push("/checkout"); }}>
          Buy now
        </button>
      )}
    </div>
  );
}
