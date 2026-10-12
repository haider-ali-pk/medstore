"use client";
import { useCallback, useEffect, useState } from "react";
import ImageUpload from "../ImageUpload";

const EMPTY = { title: "", subtitle: "", buttonText: "", linkUrl: "", imageUrl: "", sortOrder: 0, isActive: true };

export default function Banners({ call, notify }) {
  const [list, setList] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [uploads, setUploads] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => call("/admin/banners").then(setList).catch((e) => notify(e.message, "err")), [call, notify]);
  useEffect(() => { load(); call("/admin/brand").then((b) => setUploads(!!b.uploadsEnabled)).catch(() => {}); }, [load, call]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const reset = () => { setF(EMPTY); setEditId(null); };

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await call(editId ? `/admin/banners/${editId}` : "/admin/banners", { method: editId ? "PUT" : "POST", body: { ...f, sortOrder: Number(f.sortOrder || 0) } });
      notify(editId ? "Banner updated" : "Banner added. It shows on the home page within a minute.");
      reset(); load();
    } catch (e2) { notify(e2.message, "err"); }
    setBusy(false);
  }
  function edit(b) {
    setEditId(b.id);
    setF({ title: b.title, subtitle: b.subtitle || "", buttonText: b.buttonText || "", linkUrl: b.linkUrl || "", imageUrl: b.imageUrl || "", sortOrder: b.sortOrder, isActive: b.isActive });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function toggle(b) {
    try { await call(`/admin/banners/${b.id}`, { method: "PUT", body: { isActive: !b.isActive } }); load(); } catch (e) { notify(e.message, "err"); }
  }
  async function remove(b) {
    if (!confirm(`Delete banner "${b.title}"?`)) return;
    try { await call(`/admin/banners/${b.id}`, { method: "DELETE" }); load(); } catch (e) { notify(e.message, "err"); }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">{editId ? "Edit banner" : "Add a home page banner"}</h2>
        <div><label className="label">Banner picture (optional, wide pictures look best)</label><ImageUpload value={f.imageUrl} onChange={(v) => setF({ ...f, imageUrl: v })} call={call} folder="banner" enabled={uploads} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Title</label><input className="input" required placeholder="e.g. Winter care sale" value={f.title} onChange={set("title")} /></div>
          <div><label className="label">Small text</label><input className="input" placeholder="e.g. Up to 20% off vitamins" value={f.subtitle} onChange={set("subtitle")} /></div>
          <div><label className="label">Button text</label><input className="input" placeholder="Shop now" value={f.buttonText} onChange={set("buttonText")} /></div>
          <div><label className="label">Button link</label><input className="input" placeholder="/products?category=vitamins" value={f.linkUrl} onChange={set("linkUrl")} /></div>
          <div><label className="label">Order (0 shows first)</label><input className="input" type="number" min="0" value={f.sortOrder} onChange={set("sortOrder")} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--brand))]" checked={f.isActive} onChange={set("isActive")} /> Show on the website</label>
        <div className="flex gap-3">
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editId ? "Save changes" : "Add banner"}</button>
          {editId && <button type="button" className="btn btn-outline" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="card divide-y divide-slate-100">
        {!list && <div className="skeleton h-24" />}
        {list?.length === 0 && <p className="p-8 text-center text-sm text-slate-400">No banners yet.</p>}
        {list?.map((b) => (
          <div key={b.id} className={`flex flex-wrap items-center justify-between gap-3 p-5 ${b.isActive ? "" : "opacity-50"}`}>
            <div>
              <p className="font-semibold text-slate-900">{b.title}</p>
              <p className="text-sm text-slate-500">{[b.subtitle, b.linkUrl].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => edit(b)}>Edit</button>
              <button className="btn btn-outline btn-sm" onClick={() => toggle(b)}>{b.isActive ? "Hide" : "Show"}</button>
              <button className="btn btn-outline btn-sm !text-red-600" onClick={() => remove(b)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}