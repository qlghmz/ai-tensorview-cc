/**
 * Deploy to Cloudflare Workers for staging or production.
 *
 * Usage:
 *   node scripts/deploy-env.mjs staging
 *   node scripts/deploy-env.mjs production
 *
 * Loads secrets from `.env.{mode}.local` (falls back to `.env.local` for production).
 * Builds with Vite mode, patches `.output/server/wrangler.json`, pushes secrets, deploys.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync, spawnSync } from "node:child_process";

const ROOT = process.cwd();
const mode = process.argv[2];

if (!mode || !["staging", "production"].includes(mode)) {
  console.error("Usage: node scripts/deploy-env.mjs <staging|production>");
  process.exit(1);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    if (val) process.env[m[1]] = val;
  }
}

const envLocal = join(ROOT, `.env.${mode}.local`);
const fallbackLocal = join(ROOT, ".env.local");
const envMode = join(ROOT, `.env.${mode}`);

loadEnvFile(join(ROOT, ".env"));
loadEnvFile(envMode);
if (existsSync(envLocal)) {
  loadEnvFile(envLocal);
} else if (mode === "production" && existsSync(fallbackLocal)) {
  console.warn(">> Using .env.local (consider renaming to .env.production.local)");
  loadEnvFile(fallbackLocal);
} else {
  console.error(`Missing ${envLocal}`);
  console.error(`Copy .env.${mode}.example → .env.${mode}.local and fill in values.`);
  process.exit(1);
}

const workerName = process.env.WORKER_NAME || (mode === "staging" ? "ai-tensorview-staging" : "ai-tensorview-cc");
const customDomain = process.env.CUSTOM_DOMAIN?.trim();

console.log(`>> Deploy [${mode}] worker=${workerName}${customDomain ? ` domain=${customDomain}` : " (workers.dev)"}`);

console.log(`>> npm run build -- --mode ${mode}`);
execSync(`npm run build -- --mode ${mode}`, { stdio: "inherit", cwd: ROOT });

const cfgPath = join(ROOT, ".output/server/wrangler.json");
if (!existsSync(cfgPath)) {
  console.error("Build did not produce .output/server/wrangler.json");
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
cfg.name = workerName;
cfg.workers_dev = true;

if (mode === "staging" && !customDomain) {
  delete cfg.routes;
} else if (customDomain) {
  cfg.routes = [{ pattern: customDomain, custom_domain: true }];
} else if (mode === "production" && !customDomain) {
  console.warn(">> CUSTOM_DOMAIN not set; staging-style workers.dev deploy for production");
  delete cfg.routes;
}

writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
console.log(">> Patched wrangler.json");

const secrets = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DASHSCOPE_API_KEY",
  "DASHSCOPE_MODEL",
];

for (const name of secrets) {
  const val = process.env[name];
  if (!val) {
    console.warn(`   skip secret ${name} (not set)`);
    continue;
  }
  console.log(`   secret put ${name}`);
  const r = spawnSync("npx", ["wrangler", "secret", "put", name, "--config", cfgPath], {
    input: val,
    cwd: ROOT,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const deployEnv = { ...process.env };
delete deployEnv.CLOUDFLARE_API_TOKEN;

console.log(">> wrangler deploy");
execSync("npx wrangler deploy --config .output/server/wrangler.json", {
  stdio: "inherit",
  cwd: ROOT,
  env: deployEnv,
});

const url = customDomain ? `https://${customDomain}` : `https://${workerName}.${process.env.CLOUDFLARE_ACCOUNT_SUBDOMAIN || "<account>"}.workers.dev`;
console.log(`\nDone [${mode}]: ${url}`);
