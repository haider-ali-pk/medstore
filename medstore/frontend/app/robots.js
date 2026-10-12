import { headers } from "next/headers";

export default function robots() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const base = `${h.get("x-forwarded-proto") || "https"}://${host}`;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/super", "/cart", "/checkout", "/orders", "/login", "/register", "/forgot-password", "/reset-password"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}