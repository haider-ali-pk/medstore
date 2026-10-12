// frontend/components/Policy.jsx   (NEW FILE)
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, sfetch } from "@/lib/server";
import { PAGES, defaultText } from "@/lib/policies";

// Tiny formatter: "# Heading", "- bullet", blank line = new paragraph.
function parse(text) {
  const out = [];
  let para = [];
  let list = [];
  const flush = () => {
    if (para.length) { out.push({ t: "p", v: para.join(" ") }); para = []; }
    if (list.length) { out.push({ t: "ul", v: list }); list = []; }
  };
  for (const raw of String(text).replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith("## ")) { flush(); out.push({ t: "h", v: line.slice(3) }); }
    else if (line.startsWith("# ")) { flush(); out.push({ t: "h", v: line.slice(2) }); }
    else if (line.startsWith("- ")) { if (para.length) flush(); list.push(line.slice(2)); }
    else { if (list.length) flush(); para.push(line); }
  }
  flush();
  return out;
}

export default async function Policy({ slug }) {
  const page = PAGES[slug];
  if (!page) notFound();
  const [brand, pol] = await Promise.all([getBrand(), sfetch("/policies")]);
  const custom = String(pol?.[page.field] || "").trim();
  const nodes = parse(custom || defaultText(slug, brand));

  return (
    <article className="mx-auto max-w-3xl">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand">Home</Link> <span className="mx-1">/</span> {page.title}
      </nav>
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight text-slate-900">{page.title}</h1>
      <div className="card space-y-4 p-6 sm:p-10">
        {nodes.map((n, i) =>
          n.t === "h" ? (
            <h2 key={i} className="pt-2 text-lg font-bold text-slate-900">{n.v}</h2>
          ) : n.t === "ul" ? (
            <ul key={i} className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
              {n.v.map((x, j) => <li key={j}>{x}</li>)}
            </ul>
          ) : (
            <p key={i} className="text-sm leading-relaxed text-slate-600">{n.v}</p>
          )
        )}
      </div>
      <p className="mt-6 text-sm text-slate-500">
        Questions? <Link href="/contact" className="font-semibold text-brand">Contact us</Link>
      </p>
    </article>
  );
}