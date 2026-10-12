// frontend/app/contact/page.jsx   (NEW FILE)
import { getBrand } from "@/lib/server";
import { Phone, Mail, Pin, Whatsapp } from "@/components/Icons";

export const metadata = { title: "Contact us" };

export default async function Contact() {
  const b = await getBrand();
  const items = [
    b.phone && [Phone, "Phone", b.phone, `tel:${b.phone.replace(/\s/g, "")}`],
    b.whatsapp && [Whatsapp, "WhatsApp", b.whatsapp, `https://wa.me/${b.whatsapp.replace(/\D/g, "")}`],
    b.email && [Mail, "Email", b.email, `mailto:${b.email}`],
    b.address && [Pin, "Address", b.address, null],
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight text-slate-900">Contact us</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map(([I, label, value, href]) => (
          <div key={label} className="card flex items-start gap-3.5 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><I size={22} /></span>
            <div className="min-w-0">
              <p className="text-sm text-slate-500">{label}</p>
              {href ? <a href={href} className="break-words font-semibold text-slate-900 hover:text-brand" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{value}</a> : <p className="font-semibold text-slate-900">{value}</p>}
            </div>
          </div>
        ))}
        {b.openingHours && (
          <div className="card p-5 sm:col-span-2"><p className="text-sm text-slate-500">Opening hours</p><p className="font-semibold text-slate-900">{b.openingHours}</p></div>
        )}
        {items.length === 0 && !b.openingHours && <p className="card p-8 text-center text-slate-500 sm:col-span-2">Contact details coming soon.</p>}
      </div>
    </div>
  );
}