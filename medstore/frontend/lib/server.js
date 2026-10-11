import { headers } from "next/headers";
import { cache } from "react";
export { formatMoney as money } from "./format";

export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const DEFAULT_BRAND = process.env.NEXT_PUBLIC_DEFAULT_BRAND;

// Brand + catalogue data is cached by Next for a short time, so pages don't wait on the API/DB every click.
const BRAND_TTL = 60;
const DATA_TTL = 30;

// Resolve which brand this request belongs to (custom domain first, then default slug).
export const getBrand = cache(async () => {
  const host = (headers().get("host") || "").split(":")[0];
  try {
    let res = await fetch(`${API}/brand`, { headers: { "x-brand-host": host }, next: { revalidate: BRAND_TTL } });
    if (!res.ok && DEFAULT_BRAND)
      res = await fetch(`${API}/brand`, { headers: { "x-brand-slug": DEFAULT_BRAND }, next: { revalidate: BRAND_TTL } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
});

// Server-side fetch scoped to the current brand.
export async function sfetch(path, revalidate = DATA_TTL) {
  const brand = await getBrand();
  if (!brand) return null;
  try {
    const res = await fetch(`${API}${path}`, { headers: { "x-brand-slug": brand.slug }, next: { revalidate } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const hexToRgb = (hex) => {
  const h = (hex || "#0f766e").replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
};
