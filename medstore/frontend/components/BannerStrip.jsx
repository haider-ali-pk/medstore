import Link from "next/link";
import { sfetch } from "@/lib/server";

export default async function BannerStrip() {
  const banners = await sfetch("/banners", 60);
  if (!banners?.length) return null;
  const one = banners.length === 1;
  return (
    <section className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
      {banners.map((b) => {
        const body = (
          <div className={`relative h-44 overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-accent text-white sm:h-52 ${one ? "w-full" : "w-[88vw] sm:w-[46vw] lg:w-[31vw]"} shrink-0 snap-start`}>
            {b.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            )}
            <div className={`absolute inset-0 ${b.imageUrl ? "bg-gradient-to-r from-black/60 via-black/25 to-transparent" : ""}`} />
            <div className="relative flex h-full flex-col justify-center gap-1.5 p-6 sm:p-8">
              <p className="max-w-xs text-xl font-extrabold leading-tight sm:text-2xl">{b.title}</p>
              {b.subtitle && <p className="max-w-xs text-sm text-white/90">{b.subtitle}</p>}
              {b.buttonText && <span className="mt-2 inline-flex w-fit rounded-full bg-white px-4 py-1.5 text-sm font-bold text-brand">{b.buttonText}</span>}
            </div>
          </div>
        );
        return b.linkUrl ? <Link key={b.id} href={b.linkUrl} className={one ? "w-full" : "shrink-0"}>{body}</Link> : <div key={b.id} className={one ? "w-full" : "shrink-0"}>{body}</div>;
      })}
    </section>
  );
}