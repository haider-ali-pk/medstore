// Supabase's pooler (pgbouncer) breaks Prisma's prepared statements unless ?pgbouncer=true is set.
// This adds the right flags automatically so a wrong/missing flag in .env can't break the app.
module.exports = function dbUrl() {
  const raw = process.env.DATABASE_URL || "";
  try {
    if (/pooler\.supabase\.com|:6543\//.test(raw)) {
      const u = new URL(raw);
      if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
      // Serverless: keep it small, many function instances share the pooler.
      if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", process.env.VERCEL ? "2" : "5");
      if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
      return u.toString();
    }
  } catch {}
  return raw;
};
