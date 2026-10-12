import { headers } from "next/headers";
import { sfetch } from "@/lib/server";

export default async function sitemap() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const base = `${h.get("x-forwarded-proto") || "https"}://${host}`;
  const data = await sfetch("/sitemap", 300);

  const pages = ["", "/products", "/branches", "/about", "/contact", "/terms", "/privacy", "/returns", "/shipping"].map((p) => ({
    url: base + p, changeFrequency: "weekly", priority: p === "" ? 1 : 0.6,
  }));
  const cats = (data?.categories || []).map((c) => ({ url: `${base}/products?category=${c.slug}`, changeFrequency: "weekly", priority: 0.7 }));
  const prods = (data?.products || []).map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.createdAt, changeFrequency: "weekly", priority: 0.8 }));
  return [...pages, ...cats, ...prods];
}