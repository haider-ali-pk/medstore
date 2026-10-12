import Link from "next/link";
import { getBrand, sfetch } from "@/lib/server";
import { Phone, Pin, Whatsapp } from "@/components/Icons";

export const metadata = { title: "Our branches" };

export default async function BranchesPage() {
  const [brand, list] = await Promise.all([getBrand(), sfetch("/branches", 60)]);
  // No branches added yet: show the main shop as the single location
  const branches = list?.length
    ? list
    : [{ id: "main", name: brand.name, address: brand.address, city: "", phone: brand.phone, whatsapp: brand.whatsapp, openingHours: brand.openingHours, mapUrl: "" }];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Our branches</h1>
        <p className="mt-1 text-slate-500">Visit or call the branch nearest to you.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => (
          <div key={b.id} className="card space-y-3 p-6">
            <p className="text-lg font-extrabold text-slate-900">{b.name}{b.city ? <span className="font-medium text-slate-400"> · {b.city}</span> : null}</p>
            {b.address && <p className="flex items-start gap-2 text-sm text-slate-600"><Pin size={16} className="mt-0.5 shrink-0 text-brand" />{b.address}</p>}
            {b.phone && <p className="flex items-start gap-2 text-sm text-slate-600"><Phone size={16} className="mt-0.5 shrink-0 text-brand" /><a href={`tel:${b.phone.replace(/\s/g, "")}`} className="hover:text-brand">{b.phone}</a></p>}
            {b.openingHours && <p className="text-sm text-slate-600"><b className="text-slate-800">Open:</b> {b.openingHours}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {b.mapUrl && <a href={b.mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Open in Maps</a>}
              {b.whatsapp && <a href={`https://wa.me/${b.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><Whatsapp size={15} /> WhatsApp</a>}
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500">Prefer delivery? See our <Link href="/shipping" className="font-semibold text-brand">Delivery Policy</Link>.</p>
    </div>
  );
}