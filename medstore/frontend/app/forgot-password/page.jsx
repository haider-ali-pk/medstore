"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/components/Providers";

export default function ForgotPassword() {
  const { call } = useStore();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await call("/auth/forgot", { method: "POST", auth: false, body: { email } });
      setMsg(r.message);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} className="card space-y-4 p-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Forgot your password?</h1>
        <p className="text-sm text-slate-500">Enter your email and we will send you a link to choose a new one.</p>
        {msg ? (
          <p className="rounded-xl bg-emerald-50 p-3.5 text-sm text-emerald-800">{msg}</p>
        ) : (
          <>
            <div><label className="label">Email</label><input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
            {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
            <button className="btn btn-primary w-full !py-3" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          </>
        )}
        <p className="text-center text-sm text-slate-500"><Link href="/login" className="font-semibold text-brand">Back to login</Link></p>
      </form>
    </div>
  );
}