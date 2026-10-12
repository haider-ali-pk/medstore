"use client";
import { useCallback, useEffect, useState } from "react";
import BranchStock from "./BranchStock";

const EMPTY = { name: "", address: "", city: "", phone: "", whatsapp: "", openingHours: "", mapUrl: "", isActive: true };

export default function Branches({ call, notify }) {
  const [list, setList] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [stockFor, setStockFor] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => call("/admin/branches").then(setList).catch((e) => notify(e.message, "err")),
    [call, notify]
  );
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const reset = () => { setF(EMPTY); setEditId(null); };

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await call(editId ? `/admin/branches/${editId}` : "/admin/branches", { method: editId ? "PUT" : "POST", body: f });
      notify(editId ? "Branch updated" : "Branch added");
      reset();
      load();
    } catch (e2) { notify(e2.message, "err"); }
    setBusy(false);
  }

  function edit(b) {
    setEditId(b.id);
    setF({ name: b.name, address: b.address, city: b.city || "", phone: b.phone || "", whatsapp: b.whatsapp || "", openingHours: b.openingHours || "", mapUrl: b.mapUrl || "", isActive: b.isActive });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function toggle(b) {
    try { await call(`/admin/branches/${b.id}`, { method: "PUT", body: { isActive: !b.isActive } }); load(); }
    catch (e) { notify(e.message, "err"); }
  }
  async function remove(b) {
    if (!confirm(`Delete branch "${b.name}"? Its stock list is deleted too.`)) return;
    try { await call(`/admin/branches/${b.id}`, { method: "DELETE" }); notify("Branch deleted"); load(); }
    catch (e) { notify(e.message, "err"); }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">{editId ? "Edit branch" : "Add a branch"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Branch name</label><input className="input" required placeholder="e.g. Gulberg Branch" value={f.name} onChange={set("name")} /></div>
          <div><label className="label">City</label><input className="input" placeholder="Lahore" value={f.city} onChange={set("city")} /></div>
          <div className="sm:col-span-2"><label className="label">Address</label><input className="input" required value={f.address} onChange={set("address")} /></div>
          <div><label className="label">Phone</label><input className="input" placeholder="+92 300 1234567" value={f.phone} onChange={set("phone")} /></div>
          <div><label className="label">WhatsApp</label><input className="input" placeholder="923001234567" value={f.whatsapp} onChange={set("whatsapp")} /></div>
          <div><label className="label">Opening hours</label><input className="input" placeholder="Mon–Sat 9am–11pm" value={f.openingHours} onChange={set("openingHours")} /></div>
          <div><label className="label">Google Maps link (optional)</label><input className="input" placeholder="https://maps.google.com/..." value={f.mapUrl} onChange={set("mapUrl")} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--brand))]" checked={f.isActive} onChange={set("isActive")} /> Show on the website</label>
        <div className="flex gap-3">
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editId ? "Save changes" : "Add branch"}</button>
          {editId && <button type="button" className="btn btn-outline" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="card divide-y divide-slate-100">
        {!list && <div className="skeleton h-24" />}
        {list?.length === 0 && <p className="p-8 text-center text-sm text-slate-400">No branches yet. The website shows the main address from Settings until you add one.</p>}
        {list?.map((b) => (
          <div key={b.id} className="space-y-3 p-5">
            <div className={`flex flex-wrap items-center justify-between gap-3 ${b.isActive ? "" : "opacity-50"}`}>
              <div>
                <p className="font-semibold text-slate-900">{b.name}{b.city ? ` · ${b.city}` : ""}</p>
                <p className="text-sm text-slate-500">{b.address}</p>
                <p className="text-xs text-slate-400">{[b.phone, b.openingHours].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-outline btn-sm" onClick={() => setStockFor(stockFor === b.id ? null : b.id)}>{stockFor === b.id ? "Close stock" : "Stock"}</button>
                <button className="btn btn-outline btn-sm" onClick={() => edit(b)}>Edit</button>
                <button className="btn btn-outline btn-sm" onClick={() => toggle(b)}>{b.isActive ? "Hide" : "Show"}</button>
                <button className="btn btn-outline btn-sm !text-red-600" onClick={() => remove(b)}>Delete</button>
              </div>
            </div>
            {stockFor === b.id && <BranchStock branch={b} call={call} notify={notify} />}
          </div>
        ))}
      </div>
    </div>
  );
}