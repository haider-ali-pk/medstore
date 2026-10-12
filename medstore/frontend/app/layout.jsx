import "./globals.css";
import Script from "next/script";
import { headers } from "next/headers";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getBrand, sfetch, hexToRgb } from "@/lib/server";

export async function generateMetadata() {
  const brand = await getBrand();
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const base = host ? `${h.get("x-forwarded-proto") || "https"}://${host}` : undefined;
  const title = brand ? `${brand.name} — Pharmacy, Health & Accessories Store` : "Store";
  const description = brand?.tagline || "Genuine medicines, devices and health essentials delivered to your door.";
  return {
    metadataBase: base ? new URL(base) : undefined,
    title: { default: title, template: `%s | ${brand?.name || "Store"}` },
    description,
    openGraph: { siteName: brand?.name, title, description, type: "website", ...(brand?.logoUrl ? { images: [brand.logoUrl] } : {}) },
    twitter: { card: "summary", title, description },
  };
}

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default async function RootLayout({ children }) {
  const brand = await getBrand();

  if (!brand) {
    return (
      <html lang="en">
        <body>
          <main className="grid min-h-screen place-items-center p-6 text-center">
            <div>
              <h1 className="text-2xl font-bold">Store not found</h1>
              <p className="mt-2 text-slate-500">This address is not linked to a brand, or the API is not running.</p>
            </div>
          </main>
        </body>
      </html>
    );
  }

  const categories = (await sfetch("/categories")) || [];
  const theme = `:root{--brand:${hexToRgb(brand.primaryColor)};--accent:${hexToRgb(brand.accentColor)};}`;
  const ga = /^G-[A-Z0-9]{4,15}$/.test(brand.gaId || "") ? brand.gaId : null;

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: theme }} />
      </head>
      <body>
        <Providers brand={brand} categories={categories}>
          <Header />
          <main className="container-x min-h-[70vh] py-8">{children}</main>
          <Footer />
        </Providers>
        {ga && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}</Script>
          </>
        )}
      </body>
    </html>
  );
}