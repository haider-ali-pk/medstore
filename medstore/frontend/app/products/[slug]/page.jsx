import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCart from "@/components/AddToCart";
import ProductCard, { ProductImage } from "@/components/ProductCard";
import { Shield, Truck, Lock } from "@/components/Icons";
import { getBrand, money, sfetch } from "@/lib/server";

export async function generateMetadata({ params }) {
  const p = await sfetch(`/products/${params.slug}`);
  if (!p) return { title: "Product" };
  const desc = (p.description || `Buy ${p.name} online.`).slice(0, 160);
  return {
    title: p.name,
    description: desc,
    alternates: { canonical: `/products/${params.slug}` },
    openGraph: { title: p.name, description: desc, type: "website", ...(p.imageUrl ? { images: [p.imageUrl] } : {}) },
    twitter: { card: p.imageUrl ? "summary_large_image" : "summary", title: p.name, description: desc },
  };
}

export default async function ProductPage({ params }) {
  const [brand, p] = await Promise.all([getBrand(), sfetch(`/products/${params.slug}`)]);
  if (!p) notFound();
  const related = p.category ? await sfetch(`/products?category=${p.category.slug}&limit=5`) : null;
  const more = related?.items?.filter((x) => x.id !== p.id).slice(0, 4);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description || undefined,
    image: p.imageUrl || undefined,
    sku: p.sku || undefined,
    brand: p.manufacturer ? { "@type": "Brand", name: p.manufacturer } : undefined,
    offers: { "@type": "Offer", priceCurrency: brand.currency, price: Number(p.price), availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  return (
       <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div>
        <nav className="mb-5 text-sm text-slate-500">
          <Link href="/" className="hover:text-brand">Home</Link> <span className="mx-1">/</span>
          <Link href="/products" className="hover:text-brand">Shop</Link>
          {p.category && <><span className="mx-1">/</span><Link href={`/products?category=${p.category.slug}`} className="hover:text-brand">{p.category.name}</Link></>}
        </nav>
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="card overflow-hidden">
            <ProductImage src={p.imageUrl} alt={p.name} className="aspect-square w-full" />
          </div>
          <div className="space-y-5">
            {p.category && <span className="badge bg-accent/10 text-accent">{p.category.name}</span>}
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{p.name}</h1>
            {(p.genericName || p.manufacturer) && <p className="text-sm text-slate-500">{[p.genericName, p.manufacturer].filter(Boolean).join(" · ")}</p>}
            <p className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-brand">{money(p.price, brand.currency)}</span>
              {Number(p.comparePrice) > Number(p.price) && <span className="text-lg text-slate-400 line-through">{money(p.comparePrice, brand.currency)}</span>}
            </p>
            {p.requiresRx && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                <b>Prescription required.</b> Our pharmacist may contact you to verify your prescription before dispatch.
              </p>
            )}
            <p className="text-sm font-semibold">
              {p.stock > 0 ? <span className="text-emerald-600">● In stock{p.stock <= 10 ? ` — only ${p.stock} left` : ""}</span> : <span className="text-red-600">● Out of stock</span>}
            </p>
            {p.description && <p className="leading-relaxed text-slate-600">{p.description}</p>}
            <AddToCart product={p} />
            <ul className="grid gap-3 border-t border-slate-200 pt-5 text-sm text-slate-600 sm:grid-cols-3">
              <li className="flex items-center gap-2"><Shield size={18} className="text-brand" /> Genuine product</li>
              <li className="flex items-center gap-2"><Truck size={18} className="text-brand" /> Fast delivery</li>
              <li className="flex items-center gap-2"><Lock size={18} className="text-brand" /> Secure checkout</li>
            </ul>
          </div>
        </div>
      </div>
      {more?.length > 0 && (
        <section>
          <h2 className="mb-5 text-xl font-extrabold text-slate-900">You may also need</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {more.map((x) => <ProductCard key={x.id} p={x} />)}
          </div>
        </section>
      )}
    </div>
  );
}
