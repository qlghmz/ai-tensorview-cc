/**
 * Bind a custom domain to the Cloudflare Worker (optional ops script).
 *
 * Requires:
 *   .cloudflare-dns-token  — DNS Edit API token (NOT in .env — Wrangler conflicts)
 *   .env.production.local or env vars: CLOUDFLARE_ZONE_ID, CUSTOM_DOMAIN, WORKER_NAME
 *
 * Usage: npm run bind:domain
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    if (val) process.env[m[1]] = val;
  }
}

loadEnvFile(join(ROOT, ".env"));
loadEnvFile(join(ROOT, ".env.production"));
if (existsSync(join(ROOT, ".env.production.local"))) loadEnvFile(join(ROOT, ".env.production.local"));
else if (existsSync(join(ROOT, ".env.local"))) loadEnvFile(join(ROOT, ".env.local"));

const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const HOSTNAME = process.env.CUSTOM_DOMAIN;
const WORKER = process.env.WORKER_NAME || "ai-tensorview-cc";

if (!ZONE_ID || !HOSTNAME) {
  console.error("Set CLOUDFLARE_ZONE_ID and CUSTOM_DOMAIN in .env.production.local");
  process.exit(1);
}

function getDnsToken() {
  const tokenPath = join(ROOT, ".cloudflare-dns-token");
  if (!existsSync(tokenPath)) {
    console.error(`
Missing .cloudflare-dns-token (DNS Edit API token)

Create at https://dash.cloudflare.com/profile/api-tokens → Edit zone DNS
Save token (one line) to: .cloudflare-dns-token
`);
    process.exit(1);
  }
  return readFileSync(tokenPath, "utf8").trim();
}

async function cf(path, init = {}) {
  const token = getDnsToken();
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json();
  if (!data.success) {
    const msg = data.errors?.map((e) => `[${e.code}] ${e.message}`).join("; ") || res.statusText;
    throw new Error(`${path}: ${msg}`);
  }
  return data;
}

async function deleteConflictingDns() {
  console.log(`>> Delete DNS records for ${HOSTNAME}`);
  const { result } = await cf(`/zones/${ZONE_ID}/dns_records?per_page=100`);
  const short = HOSTNAME.split(".")[0];
  const targets = result.filter((r) => r.name === HOSTNAME || r.name === short);
  if (!targets.length) {
    console.log("   No records to delete");
    return;
  }
  for (const rec of targets) {
    console.log(`   DELETE ${rec.type} ${rec.name} -> ${rec.content}`);
    await cf(`/zones/${ZONE_ID}/dns_records/${rec.id}`, { method: "DELETE" });
  }
}

function patchWranglerRoutes() {
  const cfgPath = join(ROOT, ".output/server/wrangler.json");
  if (!existsSync(cfgPath)) {
    console.log(">> npm run build");
    execSync("npm run build -- --mode production", { stdio: "inherit", cwd: ROOT });
  }
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.name = WORKER;
  cfg.routes = [{ pattern: HOSTNAME, custom_domain: true }];
  cfg.workers_dev = true;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  console.log(">> Patched wrangler routes");
}

async function main() {
  await deleteConflictingDns();
  patchWranglerRoutes();
  const deployEnv = { ...process.env };
  delete deployEnv.CLOUDFLARE_API_TOKEN;
  console.log(">> npx wrangler deploy");
  execSync("npx wrangler deploy --config .output/server/wrangler.json", {
    stdio: "inherit",
    cwd: ROOT,
    env: deployEnv,
  });
  console.log(`\nDone: https://${HOSTNAME}`);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
