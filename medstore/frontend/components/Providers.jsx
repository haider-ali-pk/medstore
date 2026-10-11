"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export default function Providers({ brand, categories = [], children }) {
  const tokenKey = `${brand.slug}:token`;
  const userKey = `${brand.slug}:user`;
  const cartKey = `${brand.slug}:cart`;
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]); // [{ id, slug, name, price, imageUrl, quantity, stock }]
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState([]);
  const tid = useRef(0);

  const notify = useCallback((msg, type = "ok") => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const call = useCallback(
    async (path, { method = "GET", body, auth = true } = {}) => {
      const t = typeof window !== "undefined" ? localStorage.getItem(tokenKey) : null;
      let res;
      try {
        res = await fetch(`${API}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-brand-slug": brand.slug,
            ...(auth && t ? { Authorization: `Bearer ${t}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch {
        throw new Error("Cannot reach the server. Check your internet and try again.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    },
    [brand.slug, tokenKey]
  );

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem(cartKey) || "[]"));
      const t = localStorage.getItem(tokenKey);
      if (t) {
        setToken(t);
        // show the logged-in state instantly, then verify in the background
        const cachedUser = JSON.parse(localStorage.getItem(userKey) || "null");
        if (cachedUser) setUser(cachedUser);
        call("/auth/me")
          .then((r) => { setUser(r.user); localStorage.setItem(userKey, JSON.stringify(r.user)); })
          .catch((e) => {
            if (/token|login/i.test(e.message)) {
              localStorage.removeItem(tokenKey);
              localStorage.removeItem(userKey);
              setToken(null);
              setUser(null);
            }
          });
      }
    } catch {}
    setReady(true);
  }, [cartKey, tokenKey, userKey, call]);

  useEffect(() => {
    if (ready) localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey, ready]);

  const value = useMemo(
    () => ({
      brand,
      categories,
      user,
      token,
      ready,
      call,
      notify,
      money: (n) => formatMoney(n, brand.currency),
      cart,
      cartCount: cart.reduce((s, i) => s + i.quantity, 0),
      cartTotal: cart.reduce((s, i) => s + i.quantity * Number(i.price), 0),
      addToCart: (p, qty = 1) => {
        setCart((c) => {
          const ex = c.find((i) => i.id === p.id);
          const max = p.stock || 99;
          if (ex) return c.map((i) => (i.id === p.id ? { ...i, quantity: Math.min(i.quantity + qty, max), stock: max } : i));
          return [...c, { id: p.id, slug: p.slug, name: p.name, price: p.price, imageUrl: p.imageUrl, quantity: Math.min(qty, max), stock: max, requiresRx: !!p.requiresRx }];
        });
        notify(`${p.name} added to cart`);
      },
      setQty: (id, quantity) =>
        setCart((c) =>
          quantity < 1 ? c.filter((i) => i.id !== id) : c.map((i) => (i.id === id ? { ...i, quantity: Math.min(quantity, i.stock || 99) } : i))
        ),
      removeFromCart: (id) => setCart((c) => c.filter((i) => i.id !== id)),
      clearCart: () => setCart([]),
      login: (t, u) => {
        localStorage.setItem(tokenKey, t);
        localStorage.setItem(userKey, JSON.stringify(u));
        setToken(t);
        setUser(u);
      },
      logout: () => {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        setToken(null);
        setUser(null);
      },
    }),
    [brand, categories, user, token, ready, call, notify, cart, tokenKey, userKey]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lift ${t.type === "err" ? "bg-red-600" : "bg-slate-900"}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
