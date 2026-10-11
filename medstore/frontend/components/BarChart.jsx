"use client";
// Tiny dependency-free bar chart (revenue per day).
export default function BarChart({ data, money }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5">
        {data.map((d) => {
          const h = Math.max(2, Math.round((d.revenue / max) * 100));
          return (
            <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
              <div className="pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white group-hover:block">
                {money(d.revenue)} · {d.orders} order{d.orders === 1 ? "" : "s"}
              </div>
              <div className="w-full rounded-t-md bg-brand/80 transition group-hover:bg-brand" style={{ height: `${h}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 text-[10px] text-slate-400">
        {data.map((d, i) => (
          <span key={d.date} className="flex-1 text-center">{i % 2 === 0 ? d.date.slice(8) : ""}</span>
        ))}
      </div>
    </div>
  );
}
