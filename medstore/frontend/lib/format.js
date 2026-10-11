// Shared by server and client components. Pakistan Rupees by default.
export function formatMoney(n, currency = "PKR") {
  const v = Number(n || 0);
  if (currency === "PKR") {
    return "Rs " + v.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

export const shortDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" });

export const dateTime = (d) =>
  new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });

// Readable order number (MS-000123). Falls back to the old short id for orders created before orderNo existed.
export const orderRef = (o) =>
  o?.orderNo ? `MS-${String(o.orderNo).padStart(6, "0")}` : `#${String(o?.id || "").slice(-8).toUpperCase()}`;
