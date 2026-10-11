import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { sfetch } from "@/lib/server";

export const metadata = { title: "Shop" };

export default async function Products({ searchParams }) {
  const { q = "", category = "", page = "1" } = searchParams;
  const qs = new URLSearchParams({ page, ...(q && { q }), ...(category && { category }) }).toString();
  const [data, categories] = await Promise.all([sfetch(`/products?${qs}`), sfetch("/categories")]);
  const link = (extra) => `/products?${new URLSearchParams({ ...(q && { q }), ...(category && { category }), ...extra })}`;
  const active = categories?.find((c) => c.slug === category);

  return (
    <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
      <aside className="lg:sticky lg:top-40 lg:h-fit">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Categories</h2>
        <ul className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
          {[{ id: "all", name: "All products", slug: "" }, ...(categories || [])].map((c) => (
            <li key={c.id} className="shrink-0">
              <Link
                href={c.slug ? link({ category: c.slug, page: 1 }) : `/products${q ? `?q=${encodeURIComponent(q)}` : ""}`}
                className={`block whitespace-nowrap rounded-xl px-3.5 py-2 text-sm transition ${
                  category === c.slug ? "bg-brand font-semibold text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-brand lg:bg-transparent lg:ring-0 lg:hover:bg-slate-100"
                }`}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {q ? `Results for “${q}”` : active ? active.name : "All products"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{data?.total ?? 0} item{data?.total === 1 ? "" : "s"}</p>
        </div>
        {data?.items?.length ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <p className="font-semibold text-slate-800">No products found</p>
            <p className="mt-1 text-sm text-slate-500">Try a different search or category.</p>
            <Link href="/products" className="btn btn-primary mt-5">Clear filters</Link>
          </div>
        )}
        {data?.pages > 1 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={link({ page: n })} className={`btn btn-sm ${n === data.page ? "btn-primary" : "btn-outline"}`}>{n}</Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
