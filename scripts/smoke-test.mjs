/** Smoke test deployed site + Supabase (staging or production) */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const mode = process.argv[2] || "production";
if (!["staging", "production"].includes(mode)) {
  console.error("Usage: node scripts/smoke-test.mjs [staging|production]");
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

const root = process.cwd();
loadEnvFile(join(root, ".env"));
loadEnvFile(join(root, `.env.${mode}`));
const local = join(root, `.env.${mode}.local`);
if (existsSync(local)) loadEnvFile(local);
else if (mode === "production" && existsSync(join(root, ".env.local"))) loadEnvFile(join(root, ".env.local"));

const workerUrl = `https://${process.env.WORKER_NAME || (mode === "staging" ? "ai-tensorview-staging" : "ai-tensorview-cc")}.workers.dev`;
const BASE =
  process.env.SMOKE_TEST_URL ||
  (process.env.CUSTOM_DOMAIN ? `https://${process.env.CUSTOM_DOMAIN}` : workerUrl);

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anon) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in env files");
  process.exit(1);
}

const pages = ["/", "/auth", "/pricing", "/docs", "/dashboard"];
let failed = 0;

console.log(`>> Smoke test [${mode}] ${BASE}`);
console.log(">> HTTP pages");
for (const p of pages) {
  try {
    const r = await fetch(BASE + p, { redirect: "manual" });
    const ok = r.status >= 200 && r.status < 400;
    console.log(ok ? "  OK" : "  FAIL", r.status, p);
    if (!ok) failed++;
  } catch (e) {
    console.log("  FAIL", p, e.message);
    failed++;
  }
}

console.log("\n>> Supabase auth signup (email confirm off)");
const supabase = createClient(url, anon);
const testEmail = `smoke+${Date.now()}@example.com`;
const { data, error } = await supabase.auth.signUp({
  email: testEmail,
  password: "SmokeTest123!",
  options: { data: { display_name: "smoke-test" } },
});
if (error) {
  console.log("  FAIL signup:", error.message);
  failed++;
} else {
  console.log("  OK signup user:", data.user?.id?.slice(0, 8));
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("\n>> Supabase REST (projects count)");
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { count, error: ce } = await service.from("projects").select("*", { count: "exact", head: true });
  if (ce) {
    console.log("  FAIL projects:", ce.message);
    failed++;
  } else {
    console.log("  OK projects in DB:", count);
  }
}

console.log(failed ? `\nFAILED ${failed} check(s)` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
