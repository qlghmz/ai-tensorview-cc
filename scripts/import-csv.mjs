/**
 * 从 Lovable Cloud 导出的 CSV 批量导入到新 Supabase。
 * 用法：
 *   1. 在 Lovable → Cloud → Database → Tables 逐表 Download CSV
 *   2. 放到 data/csv/ 目录（文件名 = 表名，如 profiles.csv）
 *   3. 确保 .env.local 已配置 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   4. node scripts/import-csv.mjs
 *
 * ⚠️ auth.users 无法 CSV 导入；profiles 等依赖 user_id 的表需先有用户或手动改 CSV。
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { loadEnv } from "vite";

const root = process.cwd();
Object.assign(process.env, loadEnv("production", root, ""));

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（读 .env.local）");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** 按外键依赖顺序导入 */
const TABLE_ORDER = [
  "profiles",
  "user_roles",
  "user_credits",
  "coupon_codes",
  "projects",
  "messages",
  "payment_orders",
  "credit_transactions",
  "user_integrations",
  "project_repos",
  "user_deploy_tokens",
  "feedback",
  "email_send_log",
  "email_send_state",
  "suppressed_emails",
  "email_unsubscribe_tokens",
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
      row.push(field);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      if (c === "\r") i++;
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => {
      let v = cells[i] ?? "";
      if (v === "") obj[h] = null;
      else if (v === "true") obj[h] = true;
      else if (v === "false") obj[h] = false;
      else if (/^-?\d+$/.test(v) && !h.includes("id") && h !== "amount" && h !== "balance") obj[h] = Number(v);
      else obj[h] = v;
    });
    return obj;
  });
}

async function importTable(table, dir) {
  const path = join(dir, `${table}.csv`);
  if (!existsSync(path)) {
    console.log(`  跳过 ${table}（无 ${table}.csv）`);
    return;
  }
  const records = parseCsv(readFileSync(path, "utf8"));
  if (records.length === 0) {
    console.log(`  跳过 ${table}（空文件）`);
    return;
  }
  const { error } = await supabase.from(table).upsert(records, { onConflict: "id" });
  if (error) {
    console.error(`  ✗ ${table}:`, error.message);
  } else {
    console.log(`  ✓ ${table}: ${records.length} 行`);
  }
}

async function main() {
  const dir = join(root, "data", "csv");
  if (!existsSync(dir)) {
    console.log("创建 data/csv/ 目录，把 Lovable 导出的 CSV 放进去后重跑。");
    return;
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".csv"));
  console.log(`data/csv/ 共 ${files.length} 个文件`);
  for (const table of TABLE_ORDER) {
    await importTable(table, dir);
  }
  for (const f of files) {
    const table = basename(f, ".csv");
    if (!TABLE_ORDER.includes(table)) {
      console.log(`  未在顺序表中的文件: ${f}（请手动导入或加入 TABLE_ORDER）`);
    }
  }
}

main();
