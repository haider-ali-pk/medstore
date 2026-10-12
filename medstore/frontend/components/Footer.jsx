"use client";
// frontend/components/Footer.jsx   (REPLACE THE WHOLE FILE)
import Link from "next/link";
import { useStore } from "./Providers";
import { Phone, Mail, Pin, Whatsapp } from "./Icons";

const HELP = [
  ["/about", "About us"],
  ["/contact", "Contact us"],
  ["/branches", "Our branches"],
  ["/terms", "Terms & Conditions"],
  ["/privacy", "Privacy Policy"],
  ["/returns", "Returns & Refunds"],
  ["/shipping", "Shipping & Delivery"],
];

export default function Footer() {
  const { brand, categories } = useStore();
  return (
    <>
      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-lg font-extrabold text-slate-900">{brand.name}</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">{brand.tagline || "Genuine healthcare products, delivered."}</p>
          </div>
          <div>
            <p className="mb-3 text-sm font-bold text-slate-900">Shop</p>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link href="/products" className="hover:text-brand">All products</Link></li>
              {categories?.slice(0, 5).map((c) => (
                <li key={c.id}><Link href={`/products?category=${c.slug}`} className="hover:text-brand">{c.name}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-bold text-slate-900">Account</p>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link href="/login" className="hover:text-brand">Login</Link></li>
              <li><Link href="/register" className="hover:text-brand">Create account</Link></li>
              <li><Link href="/orders" className="hover:text-brand">My orders</Link></li>
              <li><Link href="/cart" className="hover:text-brand">Cart</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-bold text-slate-900">Help</p>
            <ul className="space-y-2 text-sm text-slate-500">
              {HELP.map(([href, label]) => (
                <li key={href}><Link href={href} className="hover:text-brand">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-bold text-slate-900">Contact us</p>
            <ul className="space-y-2.5 text-sm text-slate-500">
              {brand.phone && <li className="flex items-start gap-2"><Phone size={16} className="mt-0.5 shrink-0 text-brand" /><a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="hover:text-brand">{brand.phone}</a></li>}
              {brand.email && <li className="flex items-start gap-2"><Mail size={16} className="mt-0.5 shrink-0 text-brand" /><a href={`mailto:${brand.email}`} className="break-all hover:text-brand">{brand.email}</a></li>}
              {brand.address && <li className="flex items-start gap-2"><Pin size={16} className="mt-0.5 shrink-0 text-brand" /><span>{brand.address}</span></li>}
              {brand.openingHours && <li><b className="text-slate-700">Open:</b> {brand.openingHours}</li>}
              {!brand.phone && !brand.email && !brand.address && <li>Contact details coming soon.</li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100">
          <div className="container-x flex flex-col gap-2 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {brand.name}. All rights reserved.{brand.licenseNo && <> · Pharmacy licence no. {brand.licenseNo}</>}</p>
            <p>Always read the label and consult a healthcare professional. Prescription medicines are dispensed only against a valid prescription.</p>
          </div>
        </div>
      </footer>

      {brand.whatsapp && (
        <a
          href={`https://wa.me/${brand.whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lift transition hover:scale-105"
        >
          <Whatsapp size={28} />
        </a>
      )}
    </>
  );
}