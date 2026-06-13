/**
 * 完整数据迁移：先创建 auth.users（固定 UUID），再导入所有 CSV。
 * 用法: node scripts/import-all.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { parse } from "csv-parse/sync";
import { loadEnv } from "vite";

const root = process.cwd();
Object.assign(process.env, loadEnv("production", root, ""));

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const csvDir = join(root, "data", "csv");

function loadCsv(table) {
  const path = join(csvDir, `${table}.csv`);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  if (!text.trim()) return [];
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });
}

function nullify(row) {
  const out = { ...row };
  for (const k of Object.keys(out)) {
    if (out[k] === "" || out[k] === undefined) out[k] = null;
    else if (out[k] === "true") out[k] = true;
    else if (out[k] === "false") out[k] = false;
  }
  return out;
}

async function createAuthUsers(profiles) {
  console.log("\n>> 创建 auth.users（保留原 UUID）");
  for (const p of profiles) {
    const id = p.id;
    const email = `import+${id.slice(0, 8)}@tensorview.cc`;
    const { data: existing } = await supabase.auth.admin.getUserById(id);
    if (existing?.user) {
      console.log(`  已存在 ${p.display_name || id.slice(0, 8)}`);
      continue;
    }
    const { error } = await supabase.auth.admin.createUser({
      id,
      email,
      email_confirm: true,
      user_metadata: {
        display_name: p.display_name,
        name: p.display_name,
        avatar_url: p.avatar_url || undefined,
        migrated: true,
      },
    });
    if (error) {
      console.error(`  ✗ ${id}: ${error.message}`);
    } else {
      console.log(`  ✓ ${p.display_name || email}`);
    }
  }
}

async function upsertBatch(table, rows, batchSize = 50) {
  if (!rows?.length) {
    console.log(`  跳过 ${table}（无数据）`);
    return;
  }
  const cleaned = rows.map(nullify);
  let ok = 0;
  for (let i = 0; i < cleaned.length; i += batchSize) {
    const chunk = cleaned.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`  ✗ ${table} batch ${i}: ${error.message}`);
      return;
    }
    ok += chunk.length;
  }
  console.log(`  ✓ ${table}: ${ok} 行`);
}

async function upsertUserCredits(rows) {
  if (!rows?.length) return;
  const cleaned = rows.map(nullify);
  const { error } = await supabase.from("user_credits").upsert(cleaned, { onConflict: "user_id" });
  if (error) console.error(`  ✗ user_credits: ${error.message}`);
  else console.log(`  ✓ user_credits: ${cleaned.length} 行`);
}

async function main() {
  const profiles = loadCsv("profiles");
  if (!profiles?.length) {
    console.error("缺少 data/csv/profiles.csv");
    process.exit(1);
  }

  await createAuthUsers(profiles);

  console.log("\n>> 更新 profiles（覆盖 trigger 默认值）");
  await upsertBatch("profiles", profiles);

  const order = [
    ["user_roles", { onConflict: "id" }],
    ["user_credits", { special: "user_id" }],
    ["coupon_codes", { onConflict: "id" }],
    ["projects", { onConflict: "id", batch: 20 }],
    ["payment_orders", { onConflict: "id" }],
    ["credit_transactions", { onConflict: "id" }],
  ];

  console.log("\n>> 导入业务表");
  for (const [table, opts] of order) {
    const rows = loadCsv(table);
    if (!rows?.length) {
      console.log(`  跳过 ${table}`);
      continue;
    }
    if (opts.special === "user_id") {
      await upsertUserCredits(rows);
      continue;
    }
    await upsertBatch(table, rows, opts.batch ?? 50);
  }

  console.log("\n完成。用户需用「忘记密码」+ 真实邮箱重新设密，或重新注册。");
  console.log("Google 登录用户需在 Supabase 配好 Google OAuth 后重新授权登录。");
}

main();
