"use client";
import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import SuperEditStore from "@/components/SuperEditStore";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "super:token";

async function req(path, { method = "GET", body } = {}) {
  const t = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}/super${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const EMPTY = {
  name: "", slug: "", domain: "", tagline: "", primaryColor: "#0f766e", accentColor: "#0ea5e9", currency: "PKR",
  phone: "", whatsapp: "", email: "", address: "", licenseNo: "", openingHours: "",
  walletEnabled: true, adminEmail: "",
};
const EDITABLE = ["name", "domain", "tagline", "primaryColor", "accentColor", "currency", "phone", "whatsapp", "email", "address", "licenseNo", "openingHours", "walletEnabled"];

export default function SuperAdmin() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [brands, setBrands] = useState([]);
  const [overview, setOverview] = useState([]);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [f, setF] = useState(EMPTY);
  const [editId, setEditId] = useState(null); // null = creating a new store
  const [creds, setCreds] = useState(null);
  const [err, setErr] = useState("");
    const [editing, setEditing] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, o] = await Promise.all([req("/brands"), req("/overview")]);
      setBrands(b); setOverview(o); setAuthed(true);
    } catch { setAuthed(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function doLogin(e) {
    e.preventDefault(); setErr("");
    try {
      const r = await req("/login", { method: "POST", body: login });
      localStorage.setItem(TOKEN_KEY, r.token);
      load();
    } catch (e2) { setErr(e2.message); }
  }

  function startEdit(b) {
    setEditId(b.id); setErr(""); setNote("");
    const next = { ...EMPTY, slug: b.slug };
    for (const k of EDITABLE) next[k] = b[k] == null ? (k === "walletEnabled" ? false : "") : b[k];
    setF(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() { setEditId(null); setF(EMPTY); setErr(""); }

  async function submit(e) {
    e.preventDefault(); setErr(""); setNote(""); setBusy(true);
    try {
      if (editId) {
        const body = Object.fromEntries(EDITABLE.map((k) => [k, f[k]]));
        body.domain = f.domain || null;
        await req(`/brands/${editId}`, { method: "PATCH", body });
        setNote("Store updated. The website shows the change within a minute or two.");
        setEditId(null); setF(EMPTY);
      } else {
        const r = await req("/brands", { method: "POST", body: { ...f, domain: f.domain || null, slug: f.slug || undefined } });
        setCreds({ ...r.credentials, name: r.brand.name });
        setF(EMPTY);
      }
      load();
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  async function reset(id) {
    const r = await req(`/brands/${id}/reset-admin-password`, { method: "POST" });
    setCreds({ ...r, loginSlug: "(unchanged)", name: "Password reset" });
  }
  const toggle = async (id) => { await req(`/brands/${id}/toggle`, { method: "POST" }); load(); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  // plain function (not a component) so inputs keep focus while typing
  const field = (k, placeholder, props = {}) => (
    <input key={k} className="input" placeholder={placeholder} value={f[k] ?? ""} onChange={set(k)} {...props} />
  );

  if (authed === null) return <div className="skeleton mx-auto h-64 max-w-sm" />;

  if (!authed)
    return (
      <div className="mx-auto max-w-sm">
        <form onSubmit={doLogin} className="card space-y-4 p-8">
          <h1 className="text-xl font-extrabold">Super admin login</h1>
          <input className="input" type="email" placeholder="Email" required value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
          <input className="input" type="password" placeholder="Password" required value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
          {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
          <button className="btn btn-primary w-full">Log in</button>
        </form>
      </div>
    );

  const totalRevenue = overview.reduce((s, b) => s + b.totals.revenue, 0);
  const totalOrders = overview.reduce((s, b) => s + b.totals.orders, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Platform — all stores</h1>
        <button className="text-sm font-medium text-slate-500 hover:text-slate-800" onClick={() => { localStorage.removeItem(TOKEN_KEY); setAuthed(false); }}>Log out</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[["Stores", brands.length], ["Total orders", totalOrders], ["Total revenue", formatMoney(totalRevenue, "PKR")]].map(([l, v]) => (
          <div key={l} className="card p-5"><p className="text-sm text-slate-500">{l}</p><p className="mt-1 text-2xl font-extrabold text-brand">{v}</p></div>
        ))}
      </div>

      {note && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{note}</p>}

      {creds && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm">
          <p className="font-bold">{creds.name} — save these credentials now, they are shown only once.</p>
          <p className="mt-2">Email: <code className="rounded bg-white px-1.5 py-0.5">{creds.email}</code></p>
          <p>Password: <code className="rounded bg-white px-1.5 py-0.5">{creds.password}</code></p>
          {creds.loginSlug && <p>Store slug: <code className="rounded bg-white px-1.5 py-0.5">{creds.loginSlug}</code></p>}
          <button className="mt-3 font-semibold underline" onClick={() => setCreds(null)}>Dismiss</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={submit} className="card h-fit space-y-3 p-5">
          <h2 className="font-bold">{editId ? `Edit store: ${f.slug}` : "Create store / client"}</h2>
          {field("name", "Store name", { required: true })}
          {!editId && field("slug", "Slug (optional)")}
          {field("domain", "Domain e.g. shop.client.com (optional)")}
          {field("tagline", "Tagline")}
          {field("phone", "Phone e.g. +92 300 1234567")}
          {field("whatsapp", "WhatsApp e.g. 923001234567")}
          {field("email", "Store email (shown on website)", { type: "email" })}
          {field("address", "Address")}
          {field("licenseNo", "Pharmacy licence no. (DRAP)")}
          {field("openingHours", "Opening hours e.g. Mon–Sat 9am–11pm")}
          <div className="flex items-center gap-3 text-sm">
            <label>Main <input type="color" value={f.primaryColor} onChange={set("primaryColor")} /></label>
            <label>Accent <input type="color" value={f.accentColor} onChange={set("accentColor")} /></label>
            <input className="input !w-20" maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.walletEnabled} onChange={set("walletEnabled")} /> JazzCash / Easypaisa payments</label>
          {!editId && field("adminEmail", "Store admin email", { type: "email", required: true })}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Saving…" : editId ? "Save changes" : "Create store + admin login"}</button>
          {editId && <button type="button" className="btn btn-outline w-full" onClick={cancelEdit}>Cancel</button>}
          {editId && <p className="text-xs text-slate-400">Terms, Privacy, Returns and Delivery text are edited inside the store: Admin panel → Settings.</p>}
        </form>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b bg-slate-50"><tr><th className="th">Store</th><th className="th">Domain</th><th className="th">Orders</th><th className="th">Revenue</th><th className="th">Status</th><th className="th"></th></tr></thead>
            <tbody className="divide-y">
              {brands.map((b) => {
                const o = overview.find((x) => x.id === b.id);
                return (
                  <tr key={b.id}>
                    <td className="td font-semibold"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: b.primaryColor }} />{b.name}<div className="text-xs font-normal text-slate-400">{b.slug}</div></td>
                    <td className="td">{b.domain || "—"}</td>
                    <td className="td">{b._count.orders}</td>
                    <td className="td font-semibold">{formatMoney(o?.totals.revenue || 0, b.currency)}</td>
                    <td className="td"><span className={`badge ${b.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>{b.isActive ? "Active" : "Disabled"}</span></td>
                    <td className="td space-x-3 text-right">
                      <button className="font-semibold text-brand hover:underline" onClick={() => startEdit(b)}>Edit</button>
                   
                      <button className="font-semibold text-brand hover:underline" onClick={() => toggle(b.id)}>{b.isActive ? "Disable" : "Enable"}</button>
                      <button className="font-semibold text-brand hover:underline" onClick={() => reset(b.id)}>Reset admin pw</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {editing && <SuperEditStore brand={editing} req={req} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <p className="text-sm text-slate-500">
        To manage a store's products, orders and legal pages, open that store's website and log in at <code>/login</code> with this same super-admin email — you'll land in its Admin panel.
      </p>
    </div>
  );
}