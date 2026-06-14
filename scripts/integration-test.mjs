/**
 * Integration tests: project create, RLS, templates, messages, versions, cleanup.
 * Usage: node scripts/integration-test.mjs [production|staging]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const mode = process.argv[2] || "production";
const root = process.cwd();

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    if (val) process.env[m[1]] = val;
  }
}

loadEnvFile(join(root, ".env"));
loadEnvFile(join(root, `.env.${mode}.local`));
if (!existsSync(join(root, `.env.${mode}.local`)) && mode === "production") {
  loadEnvFile(join(root, ".env.local"));
}

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl =
  process.env.SMOKE_TEST_URL ||
  (process.env.CUSTOM_DOMAIN ? `https://${process.env.CUSTOM_DOMAIN}` : "https://ai.tensorview.cc");

if (!url || !anon || !service) {
  console.error("Missing VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

let failed = 0;
function ok(label) {
  console.log("  OK", label);
}
function fail(label, detail) {
  console.log("  FAIL", label, detail ?? "");
  failed++;
}

async function check(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
  }
}

console.log(`>> Integration test [${mode}] Supabase + ${baseUrl}\n`);

const sb = createClient(url, anon);
const admin = createClient(url, service);
const email = `integ+${Date.now()}@example.com`;
const password = "IntegTest123!";
let userId = "";
let projectId = "";
let shareToken = "";

await check("auth signUp", async () => {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { display_name: "integration" } },
  });
  if (error) throw error;
  if (!data.user?.id) throw new Error("no user id");
  userId = data.user.id;
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) throw new Error("no session after signup");
});

await check("create project (insert + select)", async () => {
  const { data, error } = await sb
    .from("projects")
    .insert({ user_id: userId, name: "Integration Test", description: "auto test prompt" })
    .select("id, name, user_id")
    .single();
  if (error) throw error;
  if (!data?.id) throw new Error("no project returned");
  if (data.user_id !== userId) throw new Error("user_id mismatch");
  projectId = data.id;
});

await check("list own projects", async () => {
  const { data, error } = await sb.from("projects").select("id").eq("user_id", userId);
  if (error) throw error;
  if (!data?.some((p) => p.id === projectId)) throw new Error("created project not in list");
});

await check("insert message on project", async () => {
  const { error } = await sb.from("messages").insert({
    project_id: projectId,
    user_id: userId,
    role: "user",
    content: "test message",
  });
  if (error) throw error;
});

await check("insert project_version snapshot", async () => {
  const bundle = {
    routes: [{ path: "/", label: "Home" }],
    files: { "/App.tsx": "export default function App(){return <div>hi</div>}" },
  };
  const { error } = await sb.from("project_versions").insert({
    project_id: projectId,
    user_id: userId,
    label: "test v1",
    preview_sandpack: bundle,
    prompt_summary: "test",
  });
  if (error) throw error;
});

await check("read community_templates", async () => {
  const { data, error } = await sb.from("community_templates").select("slug").limit(1);
  if (error) throw error;
  if (!data?.length) throw new Error("no templates");
});

await check("create share link (owner RLS)", async () => {
  shareToken = `test${Date.now().toString(16)}`;
  const { error } = await sb.from("project_share_links").insert({
    project_id: projectId,
    token: shareToken,
    role: "view",
    created_by: userId,
  });
  if (error) throw error;
});

await check("public pages /templates /gallery", async () => {
  for (const p of ["/templates", "/gallery"]) {
    const r = await fetch(baseUrl + p, { redirect: "manual" });
    if (r.status < 200 || r.status >= 400) throw new Error(`${p} status ${r.status}`);
  }
});

await check("cleanup test data", async () => {
  await admin.from("project_share_links").delete().eq("project_id", projectId);
  await admin.from("project_versions").delete().eq("project_id", projectId);
  await admin.from("messages").delete().eq("project_id", projectId);
  await admin.from("projects").delete().eq("id", projectId);
  await admin.auth.admin.deleteUser(userId);
});

console.log(failed ? `\nFAILED ${failed} check(s)` : "\nAll integration checks passed");
process.exit(failed ? 1 : 0);
