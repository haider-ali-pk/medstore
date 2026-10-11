const COLORS = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-sky-100 text-sky-800",
  SHIPPED: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
  PAID: "bg-emerald-100 text-emerald-800",
  UNPAID: "bg-slate-100 text-slate-700",
  FAILED: "bg-red-100 text-red-800",
};
export function StatusBadge({ status }) {
  return <span className={`badge ${COLORS[status] || "bg-slate-100 text-slate-700"}`}>{String(status).charAt(0) + String(status).slice(1).toLowerCase()}</span>;
}
