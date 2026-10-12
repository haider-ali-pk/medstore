"use client";
import { useCallback, useEffect, useState } from "react";

const EMPTY = { code: "", type: "PERCENT", value: "", minSubtotal: "", maxUses: "", expiresAt: "", isActive: true };

export default function Coupons({ call, money, notify }) {
  const [list, setList] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => call("/admin/coupons").then(setList).catch((e) => notify(e.message, "err")), [call, notify]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const reset = () => { setF(EMPTY); setEditId(null); };

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        code: f.code.trim().toUpperCase(), type: f.type, value: Number(f.value),
        minSubtotal: f.minSubtotal === "" ? null : Number(f.minSubtotal),
        maxUses: f.maxUses === "" ? null : Number(f.maxUses),
        expiresAt: f.expiresAt || null, isActive: f.isActive,
      };
      await call(editId ? `/admin/coupons/${editId}` : "/admin/coupons", { method: editId ? "PUT" : "POST", body });
      notify(editId ? "Coupon updated" : "Coupon created");
      reset(); load();
    } catch (e2) { notify(e2.message, "err"); }
    setBusy(false);
  }
  function edit(c) {
    setEditId(c.id);
    setF({ code: c.code, type: c.type, value: Number(c.value), minSubtotal: c.minSubtotal == null ? "" : Number(c.minSubtotal), maxUses: c.maxUses == null ? "" : c.maxUses, expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "", isActive: c.isActive });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function toggle(c) {
    try { await call(`/admin/coupons/${c.id}`, { method: "PUT", body: { isActive: !c.isActive } }); load(); } catch (e) { notify(e.message, "err"); }
  }
  async function remove(c) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    try { await call(`/admin/coupons/${c.id}`, { method: "DELETE" }); load(); } catch (e) { notify(e.message, "err"); }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">{editId ? "Edit coupon" : "Create a coupon code"}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className="label">Code</label><input className="input uppercase" required placeholder="WELCOME10" value={f.code} onChange={set("code")} /></div>
          <div><label className="label">Type</label><select className="input" value={f.type} onChange={set("type")}><option value="PERCENT">Percent off (%)</option><option value="FIXED">Fixed amount off (Rs)</option></select></div>
          <div><label className="label">{f.type === "PERCENT" ? "Percent" : "Amount (Rs)"}</label><input className="input" type="number" min="1" required value={f.value} onChange={set("value")} /></div>
          <div><label className="label">Minimum order (Rs, optional)</label><input className="input" type="number" min="0" value={f.minSubtotal} onChange={set("minSubtotal")} /></div>
          <div><label className="label">Max uses (optional)</label><input className="input" type="number" min="1" value={f.maxUses} onChange={set("maxUses")} /></div>
          <div><label className="label">Expires on (optional)</label><input className="input" type="date" value={f.expiresAt} onChange={set("expiresAt")} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--brand))]" checked={f.isActive} onChange={set("isActive")} /> Active</label>
        <div className="flex gap-3">
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editId ? "Save changes" : "Create coupon"}</button>
          {editId && <button type="button" className="btn btn-outline" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="card divide-y divide-slate-100">
        {!list && <div className="skeleton h-24" />}
        {list?.length === 0 && <p className="p-8 text-center text-sm text-slate-400">No coupons yet.</p>}
        {list?.map((c) => (
          <div key={c.id} className={`flex flex-wrap items-center justify-between gap-3 p-5 ${c.isActive ? "" : "opacity-50"}`}>
            <div>
              <p className="font-mono font-bold text-slate-900">{c.code} <span className="font-sans font-semibold text-brand">{c.type === "PERCENT" ? `${Number(c.value)}% off` : `${money(c.value)} off`}</span></p>
              <p className="text-xs text-slate-500">
                Used {c.usedCount}{c.maxUses != null ? ` of ${c.maxUses}` : ""}
                {c.minSubtotal != null ? ` · min order ${money(c.minSubtotal)}` : ""}
                {c.expiresAt ? ` · expires ${c.expiresAt.slice(0, 10)}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => edit(c)}>Edit</button>
              <button className="btn btn-outline btn-sm" onClick={() => toggle(c)}>{c.isActive ? "Disable" : "Enable"}</button>
              <button className="btn btn-outline btn-sm !text-red-600" onClick={() => remove(c)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}