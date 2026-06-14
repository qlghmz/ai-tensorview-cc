/** Test project create via anon client (same path as dashboard) */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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

loadEnvFile(join(root, ".env.production.local"));

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(url, anon);
const email = `projtest+${Date.now()}@example.com`;
const password = "TestProj123!";

console.log(">> signUp", email);
const { data: auth, error: ae } = await sb.auth.signUp({
  email,
  password,
  options: { data: { display_name: "proj-test" } },
});
if (ae) {
  console.error("signup failed:", ae);
  process.exit(1);
}
console.log("  user:", auth.user?.id);

// Ensure session (email confirm might be off)
const { data: sessionData } = await sb.auth.getSession();
console.log("  session:", sessionData.session ? "yes" : "no");

console.log(">> insert project (with select)");
const { data, error } = await sb
  .from("projects")
  .insert({ user_id: auth.user.id, name: "test proj", description: "hello" })
  .select()
  .single();

if (error) {
  console.error("INSERT FAILED:", error.code, error.message, error.details, error.hint);
  process.exit(1);
}
console.log("  OK project id:", data.id);

console.log(">> insert without select");
const { data: d2, error: e2 } = await sb
  .from("projects")
  .insert({ user_id: auth.user.id, name: "test2", description: "x" });
console.log("  no-select error:", e2?.message ?? "none", "data:", d2);

if (service) {
  const admin = createClient(url, service);
  await admin.from("projects").delete().eq("user_id", auth.user.id);
  await admin.auth.admin.deleteUser(auth.user.id);
  console.log(">> cleaned up test user");
}

console.log("PASS");
