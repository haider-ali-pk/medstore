const { prisma, cached } = require("./lib");

const num = (d) => Number(d || 0);
// Pakistan is UTC+5 all year (no daylight saving). Without this, orders placed between midnight and 5am
// were counted on the wrong day and "today" was wrong for the first 5 hours of every morning.
const PKT = 5 * 3600_000;
const dayKey = (d) => new Date(new Date(d).getTime() + PKT).toISOString().slice(0, 10);

/** Dashboard numbers for ONE brand. Cached 20s so refreshing the dashboard is instant. */
function brandAnalytics(brandId, days = 14) {
  return cached(`an:${brandId}:${days}`, 20_000, async () => {
    const pkNow = new Date(Date.now() + PKT);
    pkNow.setUTCHours(0, 0, 0, 0);
    pkNow.setUTCDate(pkNow.getUTCDate() - (days - 1));
    const since = new Date(pkNow.getTime() - PKT); // midnight in Pakistan, as a real moment in time
    const notCancelled = { brandId, status: { not: "CANCELLED" } };

    const [orderCount, productCount, customerCount, revenueAgg, recent, items, byStatus, lowStock, pending, collectedAgg] =
      await Promise.all([
        prisma.order.count({ where: { brandId } }),
        prisma.product.count({ where: { brandId, isActive: true } }),
        prisma.user.count({ where: { brandId, role: "CUSTOMER" } }),
        prisma.order.aggregate({ where: notCancelled, _sum: { total: true } }),
        prisma.order.findMany({ where: { ...notCancelled, createdAt: { gte: since } }, select: { createdAt: true, total: true } }),
        prisma.orderItem.findMany({
          where: { order: { ...notCancelled, createdAt: { gte: since } } },
          select: { name: true, unitPrice: true, quantity: true },
        }),
        prisma.order.groupBy({ by: ["status"], where: { brandId }, _count: { _all: true } }),
        prisma.product.findMany({
          where: { brandId, isActive: true, stock: { lte: 10 } },
          select: { id: true, name: true, stock: true, imageUrl: true },
          orderBy: { stock: "asc" },
          take: 8,
        }),
        prisma.order.count({ where: { brandId, status: "PENDING" } }),
        prisma.order.aggregate({ where: { ...notCancelled, paymentStatus: "PAID" }, _sum: { total: true } }),
      ]);

    const series = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      series.push({ date: dayKey(d), revenue: 0, orders: 0 });
    }
    const idx = new Map(series.map((s, i) => [s.date, i]));
    for (const o of recent) {
      const i = idx.get(dayKey(o.createdAt));
      if (i !== undefined) { series[i].revenue += num(o.total); series[i].orders += 1; }
    }

    const top = new Map();
    for (const it of items) {
      const t = top.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
      t.qty += it.quantity;
      t.revenue += num(it.unitPrice) * it.quantity;
      top.set(it.name, t);
    }

    const today = series[series.length - 1] || { revenue: 0, orders: 0 };
    return {
      totals: { orders: orderCount, products: productCount, customers: customerCount, revenue: num(revenueAgg._sum.total), collected: num(collectedAgg._sum.total), pending },
      today: { revenue: today.revenue, orders: today.orders },
      periodRevenue: series.reduce((s, x) => s + x.revenue, 0),
      periodOrders: series.reduce((s, x) => s + x.orders, 0),
      series,
      topProducts: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      lowStock,
    };
  });
}

module.exports = { brandAnalytics };
