// One-command setup + start. Works on Windows, macOS and Linux (no && or & needed).
// Usage:  npm start        (or: node scripts/run.js)
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend");
const frontend = path.join(root, "frontend");

const log = (m) => console.log(`\n\x1b[36m▶ ${m}\x1b[0m`);
const warn = (m) => console.log(`\x1b[33m! ${m}\x1b[0m`);

function run(cmd, cwd, opts = {}) {
  return spawnSync(cmd, { cwd, stdio: "inherit", shell: true, ...opts });
}

function copyIfMissing(from, to) {
  if (!fs.existsSync(to) && fs.existsSync(from)) {
    fs.copyFileSync(from, to);
    console.log(`  created ${path.relative(root, to)}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  log("1/5  Creating .env files (if missing)");
  copyIfMissing(path.join(backend, ".env.example"), path.join(backend, ".env"));
  copyIfMissing(path.join(frontend, ".env.example"), path.join(frontend, ".env.local"));

  log("2/5  Starting Postgres with Docker");
  const docker = run("docker compose up -d", root);
  if (docker.status !== 0) {
    warn("Docker did not start. If you already have PostgreSQL running, edit DATABASE_URL in backend/.env.");
    warn("Otherwise install/start Docker Desktop and run again.");
  }

  log("3/5  Installing packages (first run takes a few minutes)");
  for (const dir of [backend, frontend]) {
    if (!fs.existsSync(path.join(dir, "node_modules"))) {
      const r = run("npm install", dir);
      if (r.status !== 0) {
        console.error("npm install failed in " + dir);
        process.exit(1);
      }
    } else {
      console.log(`  ${path.basename(dir)}: already installed`);
    }
  }

  log("4/5  Creating database tables and demo data");
  let ok = false;
  for (let i = 1; i <= 12 && !ok; i++) {
    const r = run("npx prisma db push --skip-generate", backend, { stdio: "pipe" });
    if (r.status === 0) ok = true;
    else {
      console.log(`  waiting for database… (${i}/12)`);
      await sleep(3000);
    }
  }
  if (!ok) {
    console.error("\nCould not reach the database. Check Docker is running, or fix DATABASE_URL in backend/.env.");
    process.exit(1);
  }
  run("npx prisma generate", backend);
  run("node prisma/seed.js", backend);

  log("5/5  Starting backend (port 4000) and storefront (port 3000)");
  console.log("  Storefront:   http://localhost:3000");
  console.log("  Super admin:  http://localhost:3000/super   (admin@medstore.local / ChangeMe123!)");
  console.log("  Press Ctrl+C to stop everything.\n");

  const procs = [
    ["api", backend, "npm run dev", "\x1b[32m"],
    ["web", frontend, "npm run dev", "\x1b[35m"],
  ].map(([name, cwd, cmd, color]) => {
    const p = spawn(cmd, { cwd, shell: true });
    const prefix = (d) =>
      d
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((l) => console.log(`${color}[${name}]\x1b[0m ${l}`));
    p.stdout.on("data", prefix);
    p.stderr.on("data", prefix);
    return p;
  });

  const stop = () => {
    procs.forEach((p) => {
      try {
        if (process.platform === "win32") spawnSync(`taskkill /pid ${p.pid} /T /F`, { shell: true });
        else p.kill("SIGTERM");
      } catch {}
    });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
})();
