"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import ImageUpload from "../ImageUpload";
import { ProductImage } from "../ProductCard";
import { Plus, Edit, Trash, X, Search, List } from "../Icons";

const EMPTY = { name: "", description: "", price: "", comparePrice: "", stock: "", sku: "", genericName: "", manufacturer: "", imageUrl: "", categoryId: "", requiresRx: false, isActive: true };

export default function Products({ call, money, notify, uploadsEnabled }) {
  const [items, setItems] = useState(null);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null); // product object (existing) or EMPTY (new)
  const [showCats, setShowCats] = useState(false);

  const load = useCallback(() => {
    call("/admin/products").then(setItems).catch((e) => notify(e.message, "err"));
    call("/admin/categories").then(setCats).catch(() => {});
  }, [call, notify]);
  useEffect(load, [load]);

  const shown = useMemo(
    () => (items || []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [items, q]
  );

  async function toggle(p) {
    try { await call(`/admin/products/${p.id}`, { method: "PUT", body: { isActive: !p.isActive } }); load(); }
    catch (e) { notify(e.message, "err"); }
  }
  async function remove(p) {
    if (!confirm(`Delete "${p.name}"? Products that already have orders are hidden instead of deleted.`)) return;
    try {
      const r = await call(`/admin/products/${p.id}`, { method: "DELETE" });
      notify(r.hidden ? "Product hidden (it has past orders)" : "Product deleted");
      load();
    } catch (e) { notify(e.message, "err"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-10" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn-outline" onClick={() => setShowCats(true)}><List size={17} /> Categories</button>
        <button className="btn btn-primary" onClick={() => setEdit({ ...EMPTY })}><Plus size={17} /> Add product</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-slate-50"><tr><th className="th">Product</th><th className="th">Price</th><th className="th">Stock</th><th className="th">Visible</th><th className="th text-right">Actions</th></tr></thead>
          <tbody className="divide-y">
            {items === null && <tr><td colSpan={5} className="p-6"><div className="skeleton h-10" /></td></tr>}
            {items && shown.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-400">No products found.</td></tr>}
            {shown.map((p) => (
              <tr key={p.id} className={p.isActive ? "" : "bg-slate-50 text-slate-400"}>
                <td className="td">
                  <div className="flex items-center gap-3">
                    <ProductImage src={p.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg" />
                    <div>
                      <p className="font-semibold text-slate-900">{p.name} {p.requiresRx && <span className="badge ml-1 bg-red-100 text-red-700">Rx</span>}</p>
                      <p className="text-xs text-slate-400">{p.category?.name || "No category"}</p>
                    </div>
                  </div>
                </td>
                <td className="td font-semibold">{money(p.price)}</td>
                <td className="td"><span className={`badge ${p.stock === 0 ? "bg-red-100 text-red-700" : p.stock <= 10 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{p.stock}</span></td>
                <td className="td">
                  <button onClick={() => toggle(p)} className={`relative h-6 w-11 rounded-full transition ${p.isActive ? "bg-brand" : "bg-slate-300"}`} aria-label="Toggle visibility">
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.isActive ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </td>
                <td className="td">
                  <div className="flex justify-end gap-1.5">
                    <button className="btn btn-outline btn-sm" onClick={() => setEdit({ ...p, price: Number(p.price), comparePrice: p.comparePrice == null ? "" : Number(p.comparePrice), sku: p.sku || "", genericName: p.genericName || "", manufacturer: p.manufacturer || "", categoryId: p.categoryId || "", imageUrl: p.imageUrl || "" })}><Edit size={14} /> Edit</button>
                    <button className="btn btn-ghost btn-sm text-red-600 hover:!bg-red-50" onClick={() => remove(p)} aria-label="Delete"><Trash size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && <ProductModal init={edit} cats={cats} call={call} notify={notify} uploadsEnabled={uploadsEnabled} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {showCats && <CategoryModal cats={cats} call={call} notify={notify} onClose={() => { setShowCats(false); load(); }} />}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-items-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl bg-white shadow-lift`}>
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ProductModal({ init, cats, call, notify, uploadsEnabled, onClose, onSaved }) {
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isNew = !init.id;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const body = {
        name: f.name.trim(),
        description: f.description || "",
        price: Number(f.price),
        comparePrice: f.comparePrice === "" ? null : Number(f.comparePrice),
        stock: Number(f.stock || 0),
        sku: f.sku || null,
        genericName: f.genericName || null,
        manufacturer: f.manufacturer || null,
        imageUrl: f.imageUrl || null,
        categoryId: f.categoryId || null,
        requiresRx: !!f.requiresRx,
        isActive: !!f.isActive,
      };
      await call(isNew ? "/admin/products" : `/admin/products/${init.id}`, { method: isNew ? "POST" : "PUT", body });
      notify(isNew ? "Product added" : "Product updated");
      onSaved();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <Modal title={isNew ? "Add product" : "Edit product"} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        <div><label className="label">Picture</label><ImageUpload value={f.imageUrl} onChange={(v) => setF({ ...f, imageUrl: v })} call={call} enabled={uploadsEnabled} /></div>
        <div><label className="label">Product name</label><input className="input" required value={f.name} onChange={set("name")} /></div>
        <div><label className="label">Description / details</label><textarea className="input min-h-[110px]" value={f.description} onChange={set("description")} placeholder="Uses, dosage, ingredients, warnings…" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label">Price</label><input className="input" type="number" step="0.01" min="0" required value={f.price} onChange={set("price")} placeholder="e.g. 450" /></div>
          <div><label className="label">Stock</label><input className="input" type="number" min="0" required value={f.stock} onChange={set("stock")} /></div>
          <div><label className="label">Category</label>
            <select className="input" value={f.categoryId} onChange={set("categoryId")}>
              <option value="">No category</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Generic / salt name</label><input className="input" placeholder="e.g. Paracetamol" value={f.genericName} onChange={set("genericName")} /></div>
          <div><label className="label">Manufacturer / brand</label><input className="input" placeholder="e.g. GSK" value={f.manufacturer} onChange={set("manufacturer")} /></div>
          <div><label className="label">MRP / old price (optional)</label><input className="input" type="number" min="0" step="0.01" placeholder="shown struck-through" value={f.comparePrice} onChange={set("comparePrice")} /></div>
          <div><label className="label">SKU / barcode (optional)</label><input className="input" value={f.sku} onChange={set("sku")} /></div>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-[rgb(var(--brand))]" checked={f.requiresRx} onChange={set("requiresRx")} /> Requires prescription</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-[rgb(var(--brand))]" checked={f.isActive} onChange={set("isActive")} /> Visible in store</label>
        </div>
        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-3 border-t pt-4">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : isNew ? "Add product" : "Save changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryModal({ cats, call, notify, onClose }) {
  const [list, setList] = useState(cats);
  const [name, setName] = useState("");
  const refresh = () => call("/admin/categories").then(setList);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try { await call("/admin/categories", { method: "POST", body: { name } }); setName(""); refresh(); } catch (e2) { notify(e2.message, "err"); }
  }
  async function rename(c) {
    const n = prompt("Rename category", c.name);
    if (!n || n === c.name) return;
    try { await call(`/admin/categories/${c.id}`, { method: "PUT", body: { name: n } }); refresh(); } catch (e2) { notify(e2.message, "err"); }
  }
  async function del(c) {
    if (!confirm(`Delete "${c.name}"? Its products stay, but become uncategorised.`)) return;
    try { await call(`/admin/categories/${c.id}`, { method: "DELETE" }); refresh(); } catch (e2) { notify(e2.message, "err"); }
  }

  return (
    <Modal title="Categories" onClose={onClose}>
      <form onSubmit={add} className="flex gap-2">
        <input className="input" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary">Add</button>
      </form>
      <ul className="mt-4 divide-y">
        {list.length === 0 && <li className="py-6 text-center text-sm text-slate-400">No categories yet.</li>}
        {list.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
            <span className="font-medium">{c.name} <span className="text-xs text-slate-400">({c._count?.products ?? 0})</span></span>
            <span className="flex gap-1">
              <button className="btn btn-ghost btn-sm" onClick={() => rename(c)}><Edit size={14} /></button>
              <button className="btn btn-ghost btn-sm text-red-600" onClick={() => del(c)}><Trash size={14} /></button>
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
