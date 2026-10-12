import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getBrand, sfetch, hexToRgb } from "@/lib/server";

export async function generateMetadata() {
  const brand = await getBrand();
  return {
    title: { default: brand ? `${brand.name} — Pharmacy, Health & Accessories Store` : "Store", template: `%s | ${brand?.name || "Store"}` },
    description: brand?.tagline || "Genuine medicines, devices and health essentials delivered to your door.",
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
      </body>
    </html>
  );
}
