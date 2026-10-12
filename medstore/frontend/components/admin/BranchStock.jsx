"use client";
import { useCallback, useEffect, useState } from "react";

export default function BranchStock({ branch, call, notify }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState({});

  const load = useCallback(
    () => call(`/admin/branches/${branch.id}/stock`).then(setRows).catch((e) => notify(e.message, "err")),
    [call, notify, branch.id]
  );
  useEffect(() => { load(); }, [load]);

  async function save(p) {
    const stock = Number(edits[p.id]);
    try {
      await call(`/admin/branches/${branch.id}/stock`, { method: "PUT", body: { productId: p.id, stock } });
      setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, stock } : r)));
      setEdits((e) => { const n = { ...e }; delete n[p.id]; return n; });
      notify("Stock saved");
    } catch (e) { notify(e.message, "err"); }
  }

  if (!rows) return <div className="skeleton h-24 w-full" />;
  const shown = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 100);

  return (
    <div className="w-full space-y-3 rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-600">Stock at <b>{branch.name}</b>. This is what customers can pick up here. Home delivery uses the main stock in Products.</p>
      <input className="input" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-80 divide-y divide-slate-200 overflow-y-auto rounded-lg bg-white">
        {shown.map((p) => {
          const val = edits[p.id] ?? String(p.stock);
          const dirty = Number(val) !== p.stock;
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <input type="number" min="0" className="input !w-24 !py-1.5" value={val} onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value })} />
              <button className="btn btn-primary btn-sm" disabled={!dirty} onClick={() => save(p)}>Save</button>
            </div>
          );
        })}
        {shown.length === 0 && <p className="p-4 text-center text-sm text-slate-400">No products found.</p>}
      </div>
      {rows.length > shown.length && <p className="text-xs text-slate-400">Showing the first {shown.length}. Use search to find others.</p>}
    </div>
  );
}