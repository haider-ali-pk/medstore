"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useStore } from "@/components/Providers";

function Form() {
  const token = useSearchParams().get("token") || "";
  const { call } = useStore();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (pw !== pw2) return setErr("Passwords do not match");
    setBusy(true);
    try {
      await call("/auth/reset", { method: "POST", auth: false, body: { token, password: pw } });
      setDone(true);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  if (!token) return <p className="card p-8 text-center">This link is not valid. <Link href="/forgot-password" className="font-semibold text-brand">Request a new one</Link>.</p>;
  if (done)
    return (
      <div className="card space-y-4 p-8 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">Password changed</h1>
        <p className="text-sm text-slate-500">You can now log in with your new password.</p>
        <Link href="/login" className="btn btn-primary">Log in</Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="card space-y-4 p-8">
      <h1 className="text-2xl font-extrabold text-slate-900">Choose a new password</h1>
      <div><label className="label">New password</label><input type="password" required minLength={8} className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /><p className="mt-1 text-xs text-slate-400">At least 8 characters.</p></div>
      <div><label className="label">Confirm password</label><input type="password" required minLength={8} className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <button className="btn btn-primary w-full !py-3" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
    </form>
  );
}

export default function ResetPassword() {
  return <div className="mx-auto max-w-md"><Suspense fallback={<div className="skeleton h-64" />}><Form /></Suspense></div>;
}