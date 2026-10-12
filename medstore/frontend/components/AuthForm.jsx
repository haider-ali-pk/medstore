"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "./Providers";
import { Shield, Truck, Pill } from "./Icons";

export default function AuthForm({ mode }) {
  const { call, login, brand } = useStore();
  const router = useRouter();
  const isRegister = mode === "register";
  const [f, setF] = useState({ name: "", email: "", password: "", phone: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
    const [agree, setAgree] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (isRegister && !agree) return setErr("Please accept the Terms & Conditions and Privacy Policy to continue.");
    setBusy(true);
    try {
      const r = await call(isRegister ? "/auth/register" : "/auth/login", {
        method: "POST",
        auth: false,
        body: isRegister ? f : { email: f.email, password: f.password },
      });
      login(r.token, r.user);
      router.push(r.user.role === "CUSTOMER" ? "/" : "/admin");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft md:grid-cols-[1fr_1.1fr]">
      <div className="hidden bg-gradient-to-br from-brand to-accent p-10 text-white md:block">
        <p className="text-2xl font-extrabold leading-tight">{brand.name}</p>
        <p className="mt-2 text-sm text-white/80">{brand.tagline}</p>
        <ul className="mt-10 space-y-5 text-sm">
          <li className="flex items-center gap-3"><Pill /> Genuine medicines & devices</li>
          <li className="flex items-center gap-3"><Truck /> Fast delivery to your door</li>
          <li className="flex items-center gap-3"><Shield /> Safe & secure ordering</li>
        </ul>
      </div>
      <div className="p-7 sm:p-10">
        <h1 className="text-2xl font-extrabold text-slate-900">{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isRegister ? `Sign up to order from ${brand.name}.` : `Log in to your ${brand.name} account.`}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {isRegister && (
            <>
              <div><label className="label">Full name</label><input className="input" required value={f.name} onChange={set("name")} autoComplete="name" /></div>
              <div><label className="label">Phone / WhatsApp</label><input className="input" placeholder="03XX XXXXXXX" value={f.phone} onChange={set("phone")} autoComplete="tel" /></div>
            </>
          )}
          <div><label className="label">Email</label><input type="email" className="input" required value={f.email} onChange={set("email")} autoComplete="email" /></div>
          <div><label className="label">Password</label><input type="password" className="input" required minLength={isRegister ? 8 : 1} value={f.password} onChange={set("password")} autoComplete={isRegister ? "new-password" : "current-password"} />
            {isRegister && <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>}
          </div>
                    {isRegister && (
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" className="mt-1 accent-[rgb(var(--brand))]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I agree to the <Link href="/terms" target="_blank" className="font-semibold text-brand">Terms & Conditions</Link> and <Link href="/privacy" target="_blank" className="font-semibold text-brand">Privacy Policy</Link>.</span>
            </label>
          )}
          {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
          <button className="btn btn-primary w-full !py-3" disabled={busy}>{busy ? "Please wait…" : isRegister ? "Create account" : "Log in"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {isRegister ? <>Already have an account? <Link href="/login" className="font-semibold text-brand">Log in</Link></> : <>New here? <Link href="/register" className="font-semibold text-brand">Create an account</Link></>}
        </p>
      </div>
    </div>
  );
}
