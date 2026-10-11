"use client";
import { useRef, useState } from "react";
import { Upload, X } from "./Icons";
import { ProductImage } from "./ProductCard";

// Resizes in the browser (max 900px, WebP) before upload so pictures stay light and fast.
export function resize(file, max = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/webp", 0.85));
    };
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = url;
  });
}

export default function ImageUpload({ value, onChange, call, folder = "product", enabled = true }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const dataUrl = await resize(file, folder === "logo" ? 500 : 900);
      const r = await call("/admin/upload", { method: "POST", body: { dataUrl, folder } });
      onChange(r.url);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200">
          <ProductImage src={value} alt="" className="h-full w-full" />
          {value && (
            <button type="button" onClick={() => onChange("")} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-600 shadow hover:text-red-600" aria-label="Remove picture">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="space-y-2">
          <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
          <button type="button" className="btn btn-outline btn-sm" disabled={busy || !enabled} onClick={() => ref.current?.click()}>
            <Upload size={15} /> {busy ? "Uploading…" : value ? "Change picture" : "Upload picture"}
          </button>
          {!enabled && <p className="text-xs text-amber-600">Uploads need Supabase Storage (see README). Paste a URL below instead.</p>}
        </div>
      </div>
      <input className="input !py-2 text-xs" placeholder="…or paste an image URL" value={value || ""} onChange={(e) => onChange(e.target.value)} />
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
