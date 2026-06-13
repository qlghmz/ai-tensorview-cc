import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  extractUiBundleFence,
  patchReactImports,
  uiBundleSchema,
  tryParseUiBundle,
  type UiBundle,
} from "@/lib/ui-bundle";
import { chatCompletionNonStream, type AIProviderConfig } from "@/lib/ai-config";
import {
  detectBackendNeeds,
  isPlanConfirmed,
  renderPlanMessage,
  extractConfirmedOptions,
} from "@/lib/backend-recipes";

export const SYSTEM_PROMPT = `你是专业的「全栈 React 网页生成器」——用户用自然语言描述产品界面，你要输出**可运行的多文件 React + TypeScript 项目**（在 Sandpack 里实时预览）。

## 输出格式（必须严格遵守）

1. 先用一句中文（≤30 字）说明你准备生成 / 修改哪些页面。
2. 然后**只输出一个** Markdown 代码块，语言标记必须是 **uibundle**，内容为**合法 JSON**（不要夹杂注释、不要有尾逗号），结构如下：

\`\`\`uibundle
{
  "routes": [
    { "path": "/", "label": "首页" },
    { "path": "/about", "label": "关于" }
  ],
  "files": {
    "/App.tsx": "import { Routes, Route, Link } from 'react-router-dom';\\n...",
    "/pages/Home.tsx": "export default function Home() { ... }",
    "/styles.css": "body { margin:0; ... }"
  }
}
\`\`\`

## JSON 字段要求

- **routes**：1–5 条；**path** 必须以 \`/\` 开头；**label** 简短中文。
- **files**：键为**绝对路径**（必须以 \`/\` 开头），值是**完整文件源码字符串**（换行用 \\n）。
- **必须包含** \`/App.tsx\`：默认导出 \`App\`，使用 **react-router-dom** 的 \`<Routes>\`/\`<Route>\`/\`<Link>\` 与 routes 一致。
- **不要**输出 \`/index.tsx\`、\`/index.html\`、\`package.json\`、\`tsconfig*\`、\`vite.config\`、\`tailwind.config\` 等工程文件；宿主已注入。
- **不要**在外层加 \`BrowserRouter\` 等 Router；运行环境会注入 \`MemoryRouter\`。
- 可使用 \`/styles.css\` + Tailwind 类名（已注入 Tailwind CDN）。
- 依赖**仅限** react / react-dom / react-router-dom，不要 import 其它包。
- 用到 \`useState\`/\`useEffect\` 等必须从 'react' 命名导入；禁止 \`React.xxx\` 但没有 \`import * as React from 'react'\`。
- 视觉：现代风、响应式；文案按用户描述写真实中文，不要 Lorem。

## 体积约束（非常重要）

- **总输出（含说明 + JSON）应控制在 5000 token 内**；优先可运行、可预览。
- 单个文件 ≤ 120 行；**禁止**大段 base64、超长 SVG path、长字符串数组。
- 路由 ≤ 5；多用循环和数据数组生成卡片，不要把每张卡片硬编码。
- 数据使用极简 mock（每类 4–8 条）。
- 图片用 https://picsum.photos 或 emoji 占位，不要 base64。

## 增量修改

若上下文里带有「当前项目文件」，**保留未提及文件**做最小改动；routes 与路由组件保持同步。

## 可选：后端接口（部署到 Vercel 时可用）

若用户明确需要后端能力（保存数据、表单提交、调用第三方 API、Webhook 等），可以**额外**输出 \`/api/*.ts\` 文件，签名固定：

\`\`\`ts
export default async function handler(req: Request): Promise<Response> {
  // 用 Web 标准 Request/Response，不要用 express/next 类型
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
}
\`\`\`

约束：
- 路径必须以 \`/api/\` 开头，例如 \`/api/save.ts\`、\`/api/contact.ts\`
- 仅使用 Web 标准 API（fetch / Request / Response / crypto），**不要** import 任何 npm 包
- 单文件 ≤ 80 行；不写 secret，需要 key 的地方用 \`process.env.XXX\` 占位并在注释里说明
- 若用户没明确要求后端，**不要**输出 \`/api/*\`，免得多余

每次回复**只包含一个** \`\`\`uibundle\`\`\` 代码块，不要输出第二个代码块。`;

function summarizeSandpackForContext(bundle: UiBundle, maxPerFile = 1200): string {
  const lines: string[] = [];
  lines.push("routes: " + JSON.stringify(bundle.routes));
  for (const [path, code] of Object.entries(bundle.files)) {
    const body = code.length > maxPerFile ? code.slice(0, maxPerFile) + "\n/* …截断… */" : code;
    lines.push(`文件 ${path}:\n\`\`\`tsx\n${body}\n\`\`\``);
  }
  return lines.join("\n\n");
}

export async function beginWebsiteGeneration(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  prompt: string,
): Promise<
  | {
      ok: true;
      messages: Array<{ role: string; content: string }>;
      projectId: string;
    }
  | { ok: false; response: Response }
> {
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("id, preview_html, preview_sandpack")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (pErr || !project) {
    return { ok: false, response: new Response("项目未找到", { status: 404 }) };
  }

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(20);

  await supabase.from("messages").insert({
    project_id: projectId,
    user_id: userId,
    role: "user",
    content: prompt,
  });

  const messages: Array<{ role: string; content: string }> = [{ role: "system", content: SYSTEM_PROMPT }];

  const sandpackRow = project.preview_sandpack;
  if (sandpackRow != null && typeof sandpackRow === "object") {
    const parsedDb = uiBundleSchema.safeParse(sandpackRow);
    if (parsedDb.success) {
      messages.push({
        role: "system",
        content: `当前 React 项目（基于以下文件增量修改）：\n${summarizeSandpackForContext(parsedDb.data)}`,
      });
    }
  } else if (project.preview_html) {
    messages.push({
      role: "system",
      content:
        "（历史）该项目曾使用单页 HTML 预览；请按 UI bundle JSON 规范生成新的 React 多文件项目替换之。旧 HTML 参考：\n```html\n" +
        project.preview_html.slice(0, 8000) +
        "\n```",
    });
  }

  for (const m of history ?? []) {
    const content =
      m.role === "assistant"
        ? m.content.replace(/```(?:uibundle|lovable)[\s\S]*?```/gi, "（生成了一版 React 项目 JSON）")
        : m.content;
    messages.push({ role: m.role, content });
  }
  messages.push({ role: "user", content: prompt });

  return { ok: true, messages, projectId };
}

/** 检测 uibundle 代码块是否被截断（缺少闭合 ``` 或 JSON 大括号未闭合）。 */
export function isReplyTruncated(reply: string): boolean {
  const open = reply.match(/```(?:uibundle|lovable)\s*\n/i);
  if (!open) return false;
  const after = reply.slice((open.index ?? 0) + open[0].length);
  if (!/```/.test(after)) return true; // 没有闭合
  return false;
}

function parseBundleFromText(text: string): UiBundle | null {
  const trimmed = text.trim();
  const direct = tryParseUiBundle(trimmed);
  if (direct) return direct;
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return tryParseUiBundle(trimmed.slice(first, last + 1));
  return null;
}

export function parseUiBundleFromReply(reply: string): UiBundle | null {
  const fenced = extractUiBundleFence(reply);
  return (fenced ? parseBundleFromText(fenced) : null) ?? parseBundleFromText(reply);
}

function parseAnyJsonObject(text: string): unknown | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try {
    return JSON.parse(trimmed.slice(first, last + 1)) as unknown;
  } catch {
    return null;
  }
}

function stripCodeFence(text: string): string {
  const m = text.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n?```\s*$/);
  if (m?.[1]) return m[1].trim();
  const inner = text.match(/```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n?```/);
  return (inner?.[1] ?? text).trim();
}

function compactGenerationContext(messages?: Array<{ role: string; content: string }>): string {
  if (!messages?.length) return "";
  return messages
    .filter((m) => m.role !== "system" || m.content.includes("当前 React 项目"))
    .slice(-8)
    .map((m) => `${m.role}: ${m.content.slice(0, 1800)}`)
    .join("\n\n")
    .slice(0, 9000);
}

type PlannedRoute = { path: string; label: string; brief: string };

function normalizeRoutePath(path: string): string | null {
  const cleaned = path.trim().toLowerCase().replace(/\s+/g, "-");
  if (cleaned === "/") return "/";
  if (!/^\/[a-z0-9][a-z0-9-]{0,28}$/.test(cleaned)) return null;
  return cleaned;
}

function inferRoutes(prompt: string): PlannedRoute[] {
  const wanted: PlannedRoute[] = [{ path: "/", label: "首页", brief: "核心首页、导航、搜索、推荐内容与主要转化入口" }];
  const add = (path: string, label: string, brief: string) => {
    if (!wanted.some((r) => r.path === path)) wanted.push({ path, label, brief });
  };
  if (/登录|登陆|sign\s*in|login/i.test(prompt)) add("/login", "登录", "邮箱/手机号登录、第三方入口、忘记密码提示");
  if (/注册|signup|sign\s*up/i.test(prompt)) add("/register", "注册", "创建账号、权益说明、表单校验提示");
  if (/管理员|管理后台|后台|admin|dashboard/i.test(prompt)) add("/admin", "管理后台", "数据总览、用户管理、订单/内容审核与运营入口");
  if (/订单|预订|购买|order/i.test(prompt)) add("/orders", "订单", "订单列表、状态筛选、详情与售后入口");
  if (/我的|会员|个人|账户|account|profile/i.test(prompt)) add("/account", "我的", "个人资料、会员权益、常用服务和设置");
  if (/酒店|机票|产品|商品|资源|课程|服务|列表|分类/i.test(prompt)) add("/explore", "发现", "分类列表、筛选、卡片结果和详情入口");
  if (wanted.length === 1 && /其他网页|多页面|完善|完整|功能/.test(prompt)) {
    add("/login", "登录", "用户登录表单与安全提示");
    add("/register", "注册", "新用户注册与权益展示");
    add("/admin", "管理后台", "运营数据、内容管理和用户管理");
  }
  return wanted.slice(0, 7);
}

function normalizePlannedRoutes(input: unknown, prompt: string): PlannedRoute[] {
  const rawRoutes =
    typeof input === "object" && input !== null && Array.isArray((input as { routes?: unknown }).routes)
      ? (input as { routes: unknown[] }).routes
      : [];
  const routes: PlannedRoute[] = [];
  const push = (path: string, label: string, brief?: string) => {
    const normalized = normalizeRoutePath(path);
    if (!normalized || routes.some((r) => r.path === normalized)) return;
    routes.push({ path: normalized, label: label.trim().slice(0, 8) || "页面", brief: (brief ?? label).trim().slice(0, 80) });
  };
  push("/", "首页", "核心首页");
  for (const item of rawRoutes) {
    if (!item || typeof item !== "object") continue;
    const r = item as { path?: unknown; label?: unknown; brief?: unknown; description?: unknown };
    if (typeof r.path === "string" && typeof r.label === "string") {
      push(r.path, r.label, typeof r.brief === "string" ? r.brief : typeof r.description === "string" ? r.description : r.label);
    }
  }
  for (const r of inferRoutes(prompt)) push(r.path, r.label, r.brief);
  return routes.slice(0, 7);
}

type PreviewTheme = {
  label: string;
  bg: string;
  ink: string;
  muted: string;
  line: string;
  card: string;
  brand: string;
  brand2: string;
  accent: string;
  radius: string;
  font: string;
  bodyBgExtra?: string;
};

const DEFAULT_THEME: PreviewTheme = {
  label: "中性极简",
  bg: "#fafaf9", ink: "#0a0a0a", muted: "#71717a", line: "#e7e5e4", card: "#ffffff",
  brand: "#0a0a0a", brand2: "#525252", accent: "#f97316", radius: "14px",
  font: "ui-sans-serif,system-ui,-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif",
};

function inferTheme(prompt: string, context: string): PreviewTheme {
  const text = `${context}\n${prompt}`;
  const PRESETS: Array<{ test: RegExp; theme: Partial<PreviewTheme> & { label: string; brand: string } }> = [
    { test: /飞猪|fliggy/i, theme: { label: "飞猪旅行", brand: "#ff6a00", brand2: "#ff3d71", accent: "#ff9500", bg: "#fff7ed", bodyBgExtra: "radial-gradient(circle at 80% 0%,#ffe7ba,transparent 35%)" } },
    { test: /淘宝|taobao/i, theme: { label: "淘宝", brand: "#ff5000", brand2: "#ff7800", accent: "#ff0036", bg: "#fff4e6" } },
    { test: /天猫|tmall/i, theme: { label: "天猫", brand: "#ff0036", brand2: "#ff4081", accent: "#ff5000", bg: "#fff0f3" } },
    { test: /京东|jd\.com/i, theme: { label: "京东", brand: "#e1251b", brand2: "#c81623", accent: "#ff8800", bg: "#fff" } },
    { test: /拼多多|pdd/i, theme: { label: "拼多多", brand: "#e02e24", brand2: "#ff5b50", accent: "#ffa940", bg: "#fff5f4" } },
    { test: /美团|meituan|大众点评/i, theme: { label: "美团", brand: "#ffc300", brand2: "#ffae00", accent: "#ff6900", ink: "#222", bg: "#fffbe6" } },
    { test: /饿了么|ele/i, theme: { label: "饿了么", brand: "#0099ff", brand2: "#00b4ff", accent: "#ffd400", bg: "#f0faff" } },
    { test: /抖音|tiktok|douyin/i, theme: { label: "抖音", brand: "#fe2c55", brand2: "#25f4ee", accent: "#fe2c55", ink: "#ffffff", muted: "#a1a1aa", line: "#262626", card: "#161616", bg: "#0a0a0a" } },
    { test: /小红书|xiaohongshu|redbook/i, theme: { label: "小红书", brand: "#ff2442", brand2: "#ff4d6d", accent: "#ff7a90", bg: "#fff5f6" } },
    { test: /b站|bilibili|哔哩/i, theme: { label: "Bilibili", brand: "#fb7299", brand2: "#00a1d6", accent: "#23ade5", bg: "#f4f4f5" } },
    { test: /微信|wechat|腾讯/i, theme: { label: "微信", brand: "#07c160", brand2: "#10b981", accent: "#576b95", bg: "#ededed" } },
    { test: /支付宝|alipay/i, theme: { label: "支付宝", brand: "#1677ff", brand2: "#0e63d6", accent: "#00a6fb", bg: "#f5faff" } },
    { test: /苹果|apple|iphone|mac/i, theme: { label: "Apple", brand: "#0a0a0a", brand2: "#1d1d1f", accent: "#0071e3", bg: "#ffffff", font: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif" } },
    { test: /notion/i, theme: { label: "Notion", brand: "#0a0a0a", brand2: "#37352f", accent: "#2383e2", bg: "#ffffff" } },
    { test: /github/i, theme: { label: "GitHub", brand: "#24292f", brand2: "#0969da", accent: "#2da44e", bg: "#f6f8fa" } },
    { test: /星巴克|starbucks/i, theme: { label: "Starbucks", brand: "#006241", brand2: "#1e3932", accent: "#cba258", bg: "#f9f6f1" } },
    { test: /麦当劳|mcdonald/i, theme: { label: "麦当劳", brand: "#ffc72c", brand2: "#da291c", accent: "#27251f", ink: "#27251f", bg: "#fffbea" } },
    { test: /暗黑|赛博|cyber|科技|geek|dark mode|深色/i, theme: { label: "暗黑科技", brand: "#7c3aed", brand2: "#06b6d4", accent: "#22d3ee", ink: "#f5f5f5", muted: "#a3a3a3", line: "#262626", card: "#171717", bg: "#0a0a0a" } },
    { test: /复古|文艺|杂志|magazine|retro/i, theme: { label: "复古文艺", brand: "#1c1917", brand2: "#78350f", accent: "#c2410c", bg: "#fdf6e3", font: "'Noto Serif SC',Georgia,serif" } },
    { test: /儿童|早教|kid|child/i, theme: { label: "儿童", brand: "#fb7185", brand2: "#fbbf24", accent: "#34d399", bg: "#fff1f2", radius: "22px" } },
    { test: /金融|银行|bank|证券|理财/i, theme: { label: "金融", brand: "#1e3a8a", brand2: "#1e40af", accent: "#dc2626", bg: "#f8fafc" } },
    { test: /奢侈|luxury|高端|轻奢/i, theme: { label: "奢华", brand: "#0a0a0a", brand2: "#525252", accent: "#a8783e", bg: "#fafaf9", font: "'Cormorant Garamond',Georgia,serif" } },
  ];
  for (const p of PRESETS) {
    if (p.test.test(text)) return { ...DEFAULT_THEME, ...p.theme };
  }
  return DEFAULT_THEME;
}

function themedPreviewCss(t: PreviewTheme = DEFAULT_THEME): string {
  const bodyBg = t.bodyBgExtra ? `${t.bodyBgExtra},${t.bg}` : t.bg;
  return `:root{--bg:${t.bg};--ink:${t.ink};--muted:${t.muted};--line:${t.line};--card:${t.card};--brand:${t.brand};--brand2:${t.brand2};--accent:${t.accent};--radius:${t.radius};--shadow-sm:0 1px 2px rgba(15,23,42,.05);--shadow:0 4px 14px -4px rgba(15,23,42,.08),0 12px 32px -16px rgba(15,23,42,.12);--shadow-lg:0 12px 40px -8px rgba(15,23,42,.18);--grad:linear-gradient(135deg,var(--brand),var(--brand2));font-family:${t.font};color:var(--ink);background:var(--bg);line-height:1.55}
*{box-sizing:border-box}body{margin:0;background:${bodyBg};color:var(--ink);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}button,input,textarea,select{font:inherit;color:inherit}
img{max-width:100%;display:block}
h1,h2,h3,h4{margin:0;letter-spacing:-.02em;font-weight:700}
.page,.app{min-height:100vh;display:flex;flex-direction:column}
.topbar,header{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;padding:14px max(20px,4vw);background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:saturate(160%) blur(14px);border-bottom:1px solid var(--line)}
.brand,.logo{font-size:18px;font-weight:700;letter-spacing:-.01em;color:var(--ink);display:flex;align-items:center;gap:9px;margin-right:auto;white-space:nowrap}
.brand::before,.logo::before{content:"";width:26px;height:26px;border-radius:8px;background:var(--grad);box-shadow:0 4px 12px -3px color-mix(in srgb,var(--brand) 60%,transparent)}
nav,.links{display:flex;gap:2px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
nav::-webkit-scrollbar,.links::-webkit-scrollbar{display:none}
nav a,nav button,.links a,.tab{flex:0 0 auto;border:0;background:transparent;color:var(--muted);padding:8px 13px;border-radius:9px;cursor:pointer;font-size:14px;font-weight:500;transition:all .15s ease;white-space:nowrap}
nav a:hover,nav button:hover,.links a:hover{color:var(--ink);background:color-mix(in srgb,var(--ink) 6%,transparent)}
nav a.active,nav button.active,.links a.active,.tab.active{color:var(--brand);background:color-mix(in srgb,var(--brand) 12%,transparent);font-weight:600}
.primary,button.primary,.cta{background:var(--grad);color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:600;cursor:pointer;transition:all .15s ease;font-size:14px;box-shadow:0 4px 14px -4px color-mix(in srgb,var(--brand) 55%,transparent)}
.primary:hover,button.primary:hover,.cta:hover{transform:translateY(-1px);box-shadow:0 8px 22px -6px color-mix(in srgb,var(--brand) 60%,transparent)}
.ghost,button.ghost{background:transparent;border:1px solid var(--line);color:var(--ink);border-radius:10px;padding:9px 16px;font-weight:500;cursor:pointer;font-size:14px;transition:all .15s}
.ghost:hover{border-color:var(--ink);background:color-mix(in srgb,var(--ink) 4%,transparent)}
.gradtxt{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.glow{position:relative}.glow::before{content:"";position:absolute;inset:-12% -8%;background:radial-gradient(closest-side,color-mix(in srgb,var(--brand) 30%,transparent),transparent 70%);filter:blur(28px);z-index:-1}
.pagehead{padding:56px max(20px,4vw) 28px;max-width:1200px;margin:0 auto;width:100%}
.pagehead h1{font-size:clamp(28px,3.6vw,44px);line-height:1.12;margin:12px 0 12px}
.pagehead .lead{max-width:680px;color:var(--muted);font-size:clamp(15px,1.4vw,17px);margin:0 0 22px;line-height:1.65}
.pagehead .actions{display:flex;gap:10px;flex-wrap:wrap}
.hero{padding:72px max(20px,4vw) 48px;max-width:1200px;margin:0 auto;width:100%}
.hero h1{font-size:clamp(34px,5.2vw,58px);line-height:1.06;margin:14px 0 18px}
.hero p,.hero .lead{max-width:640px;color:var(--muted);font-size:clamp(15px,1.5vw,18px);margin:0 0 26px}
.eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);padding:6px 12px;border-radius:999px;letter-spacing:.02em}
.searchbar,.search{max-width:580px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px 6px 6px 16px;display:flex;align-items:center;gap:10px;box-shadow:var(--shadow)}
.searchbar input,.search input{flex:1;border:0;outline:0;background:transparent;padding:11px 0;min-width:120px;font-size:15px}
.searchbar input::placeholder,.search input::placeholder{color:var(--muted)}
.searchbar button,.search button{border:0;border-radius:10px;padding:10px 18px;background:var(--grad);color:#fff;font-weight:600;cursor:pointer;font-size:14px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;padding:0 max(20px,4vw);max-width:1200px;margin:0 auto 32px;width:100%}
.stats .stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px}
.stats .stat .k{font-size:12px;color:var(--muted);font-weight:500;letter-spacing:.04em;text-transform:uppercase}
.stats .stat .v{font-size:26px;font-weight:700;margin-top:6px;letter-spacing:-.02em}
.stats .stat .v small{font-size:13px;font-weight:500;color:var(--accent);margin-left:6px}
.categories{padding:8px max(20px,4vw) 24px;max-width:1200px;margin:0 auto;width:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:10px}
.category{border:1px solid var(--line);background:var(--card);border-radius:14px;padding:18px 10px;display:flex;flex-direction:column;gap:8px;align-items:center;cursor:pointer;transition:all .15s ease;font-size:13px;color:var(--ink)}
.category .icon{font-size:26px}.category:hover{border-color:var(--brand);transform:translateY(-2px);box-shadow:var(--shadow)}
.grid,.cards,.products{padding:0 max(20px,4vw) 48px;max-width:1200px;margin:0 auto;width:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.section{padding:24px max(20px,4vw);max-width:1200px;margin:0 auto;width:100%}
.section-title{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:18px}
.section-title h2{font-size:22px;letter-spacing:-.02em}
.section-title a{color:var(--brand);font-size:13px;font-weight:600}
.card,article.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px;transition:all .2s ease;cursor:pointer;display:flex;flex-direction:column;gap:10px;overflow:hidden}
.card:hover{border-color:color-mix(in srgb,var(--brand) 40%,var(--line));transform:translateY(-3px);box-shadow:var(--shadow-lg)}
.card .cover{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:10px;background:color-mix(in srgb,var(--ink) 5%,transparent)}
.card h3{font-size:16px}
.card p{color:var(--muted);font-size:13.5px;line-height:1.55;margin:0}
.card .row{display:flex;align-items:center;justify-content:space-between;margin-top:auto;gap:8px}
.card .price{color:var(--brand);font-weight:700;font-size:17px}
.card .icon{font-size:26px;display:inline-flex;width:42px;height:42px;align-items:center;justify-content:center;border-radius:12px;background:color-mix(in srgb,var(--brand) 12%,transparent)}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;padding:0 max(20px,4vw) 48px;max-width:1200px;margin:0 auto;width:100%}
.feature{padding:20px;border:1px solid var(--line);border-radius:14px;background:var(--card)}
.feature .icon{width:40px;height:40px;border-radius:10px;background:var(--grad);color:#fff;display:grid;place-items:center;font-size:20px;margin-bottom:12px}
.feature h3{font-size:15.5px;margin-bottom:6px}
.feature p{color:var(--muted);font-size:13.5px;margin:0;line-height:1.6}
.listcard{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;max-width:1200px;margin:0 auto 40px;width:calc(100% - max(40px,8vw))}
.listitem{display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--card);transition:background .15s}
.listitem:hover{background:color-mix(in srgb,var(--brand) 4%,var(--card))}
.avatar{flex:0 0 auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:22px;background:color-mix(in srgb,var(--brand) 14%,transparent)}
.listitem .body{flex:1;min-width:0}
.listitem .title{font-weight:600;font-size:14.5px;margin-bottom:3px}
.listitem .meta{color:var(--muted);font-size:12.5px;display:flex;gap:8px;flex-wrap:wrap}
.listitem .right{text-align:right;font-size:13px;color:var(--muted);display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.listitem .right .price{color:var(--ink);font-weight:700;font-size:16px}
.formcard{max-width:440px;margin:0 auto 40px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:28px;box-shadow:var(--shadow)}
.formcard h2{font-size:22px;margin-bottom:6px}
.formcard p.lead{color:var(--muted);font-size:14px;margin:0 0 18px}
.formcard label{display:block;font-size:12.5px;color:var(--muted);margin:12px 0 6px;font-weight:500}
.formcard input,.formcard textarea,.formcard select{width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:10px;background:var(--bg);outline:0;font-size:14px;transition:border-color .15s,box-shadow .15s}
.formcard input:focus,.formcard textarea:focus{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 18%,transparent)}
.formcard .primary{width:100%;margin-top:18px;padding:12px}
.formcard .hint{color:var(--muted);font-size:12px;margin-top:14px;text-align:center}
.panel{margin:0 max(20px,4vw) 56px;max-width:1200px;background:linear-gradient(135deg,${t.ink === "#0a0a0a" ? "#0f172a,#1e293b" : t.ink},color-mix(in srgb,var(--ink) 80%,var(--brand)));color:#fff;border-radius:20px;padding:40px;margin-left:auto;margin-right:auto;overflow:hidden;position:relative}
.panel::before{content:"";position:absolute;inset:auto -20% -40% auto;width:60%;height:120%;background:radial-gradient(closest-side,color-mix(in srgb,var(--brand) 60%,transparent),transparent 70%);filter:blur(20px);pointer-events:none}
.panel h2{font-size:26px;letter-spacing:-.02em;margin-bottom:18px;position:relative}
.panel p{color:rgba(255,255,255,.7);max-width:560px;position:relative}
.panel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:22px;position:relative}
.panel-grid>*{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px;font-weight:500;backdrop-filter:blur(8px)}
.tablecard{max-width:1200px;margin:0 auto 40px;width:calc(100% - max(40px,8vw));border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--card)}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:12px 16px;border-bottom:1px solid var(--line)}
th{color:var(--muted);font-weight:500;font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;background:color-mix(in srgb,var(--ink) 3%,transparent)}
tr:last-child td{border-bottom:0}
.tag,.badge{display:inline-block;padding:3px 10px;border-radius:999px;background:color-mix(in srgb,var(--brand) 14%,transparent);font-size:11.5px;font-weight:600;color:var(--brand)}
.tag.ok{background:color-mix(in srgb,#10b981 16%,transparent);color:#059669}
.tag.warn{background:color-mix(in srgb,#f59e0b 16%,transparent);color:#b45309}
.tag.gray{background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--muted)}
.sitefoot{margin-top:auto;border-top:1px solid var(--line);padding:36px max(20px,4vw) 24px;background:color-mix(in srgb,var(--ink) 3%,var(--bg));color:var(--muted);font-size:13px}
.sitefoot .cols{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1.4fr repeat(3,1fr);gap:32px}
.sitefoot h4{color:var(--ink);font-size:13px;margin-bottom:12px;letter-spacing:.02em}
.sitefoot ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px}
.sitefoot a:hover{color:var(--ink)}
.sitefoot .copy{max-width:1200px;margin:24px auto 0;padding-top:18px;border-top:1px solid var(--line);font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
@media(max-width:720px){.topbar{padding:12px 16px}.brand,.logo{font-size:16px}nav a,nav button{padding:7px 10px;font-size:13px}.pagehead,.hero{padding-left:18px;padding-right:18px}.pagehead{padding-top:32px}.hero{padding-top:44px}.hero h1{font-size:32px}.pagehead h1{font-size:26px}.grid,.cards,.products,.features{padding-left:16px;padding-right:16px;gap:14px}.panel{margin:0 16px 36px;padding:28px 22px}.sitefoot .cols{grid-template-columns:1fr 1fr;gap:24px}.listcard{width:calc(100% - 32px)}.tablecard{width:calc(100% - 32px)}}`;
}

function deterministicBundle(prompt: string): UiBundle {
  const isTravel = /飞猪|旅行|旅游|酒店|机票/.test(prompt);
  const isShop = /淘宝|电商|商城|购物/.test(prompt);
  const title = isTravel ? "飞猪旅行" : isShop ? "淘宝精选" : "智能生成站点";
  const routes = inferRoutes(prompt);
  const items = isTravel
    ? ["三亚湾海景酒店", "上海直飞大阪", "云南六日自由行", "亲子乐园套票"]
    : isShop
      ? ["无线降噪耳机", "轻薄通勤双肩包", "智能扫地机器人", "春夏透气运动鞋"]
      : ["核心功能", "数据看板", "协作空间", "增长工具"];
  return {
    routes: routes.map(({ path, label }) => ({ path, label })),
    files: {
      "/App.tsx": `import { Link, Route, Routes, useLocation } from 'react-router-dom';\nimport './styles.css';\n\nconst routes = ${JSON.stringify(routes.map(({ path, label }) => ({ path, label })))};\nconst items = ${JSON.stringify(items)};\nconst icons = ['🏝️','✈️','🏨','🎁'];\n\nfunction Layout({ children }: { children: React.ReactNode }) {\n  const location = useLocation();\n  return <main className=\"page\"><header className=\"topbar\"><strong className=\"brand\">${title}</strong><nav>{routes.map((r) => <Link className={location.pathname === r.path ? 'active' : ''} to={r.path} key={r.path}>{r.label}</Link>)}</nav></header>{children}</main>;\n}\n\nfunction Home() {\n  return <Layout><section className=\"hero\"><p className=\"eyebrow\">${prompt.slice(0, 30)}</p><h1>${title}一站式体验</h1><p>完整首页、搜索、分类、推荐卡片和服务入口，适配手机与桌面预览。</p><div className=\"search\"><span>🔎</span><input placeholder=\"搜索目的地、商品或服务\" /><button>立即搜索</button></div></section><section className=\"grid\">{items.map((item, i) => <article key={item}><span>{icons[i]}</span><h3>{item}</h3><p>精选推荐 · 今日热度 {98 - i * 7}%</p><button>查看详情</button></article>)}</section></Layout>;\n}\n\nfunction GenericPage({ title, text }: { title: string; text: string }) {\n  return <Layout><section className=\"hero\"><p className=\"eyebrow\">{title}</p><h1>{title}</h1><p>{text}</p><div className=\"search\"><input placeholder={title + ' 关键词'} /><button>查询</button></div></section><section className=\"grid\">{['数据概览','快捷操作','最新记录','智能推荐'].map((x, i) => <article key={x}><span>{['📊','⚡','🧾','✨'][i]}</span><h3>{x}</h3><p>{title}模块已独立成页，可继续让 AI 深化真实业务细节。</p><button>进入</button></article>)}</section></Layout>;\n}\n\nfunction Login() { return <Layout><section className=\"hero\"><p className=\"eyebrow\">账号登录</p><h1>欢迎回来</h1><p>支持账号密码、验证码和第三方入口的登录页面。</p><div className=\"card\"><input placeholder=\"手机号 / 邮箱\" /><input placeholder=\"密码\" type=\"password\" /><button>登录</button></div></section></Layout>; }\nfunction Register() { return <Layout><section className=\"hero\"><p className=\"eyebrow\">创建账号</p><h1>注册新用户</h1><p>展示权益说明、账号信息采集和安全协议确认。</p><div className=\"card\"><input placeholder=\"手机号 / 邮箱\" /><input placeholder=\"设置密码\" type=\"password\" /><button>立即注册</button></div></section></Layout>; }\nfunction Admin() { return <Layout><section className=\"hero\"><p className=\"eyebrow\">管理后台</p><h1>运营控制台</h1><p>集中查看用户、订单、内容和数据指标。</p></section><section className=\"grid\">{['今日访问','新增用户','待处理订单','内容审核'].map((x, i) => <article key={x}><span>{['📈','👥','🧾','🛡️'][i]}</span><h3>{x}</h3><p>后台核心指标与管理入口。</p><button>管理</button></article>)}</section></Layout>; }\n\nexport default function App() {\n  return <Routes>${routes.map((r) => `<Route path=\"${r.path}\" element={${r.path === "/" ? "<Home />" : r.path === "/login" ? "<Login />" : r.path === "/register" ? "<Register />" : r.path === "/admin" ? "<Admin />" : `<GenericPage title=\"${r.label}\" text=\"${r.brief}\" />`}} />`).join("")}<Route path=\"*\" element={<Home />} /></Routes>;\n}`,
      "/styles.css": `body{margin:0;font-family:Inter,Arial,'Microsoft YaHei',sans-serif;background:#f6f7fb;color:#111827}.page{min-height:100vh}.topbar{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 7vw;background:white;box-shadow:0 8px 30px rgba(15,23,42,.08);position:sticky;top:0;z-index:2}.topbar strong{font-size:24px;color:#ff6a00}.topbar nav{display:flex;gap:10px;flex-wrap:wrap}.topbar button,.search button,article button{border:0;border-radius:999px;padding:10px 16px;background:#f1f5f9;cursor:pointer}.topbar .active,.search button,article button{background:linear-gradient(135deg,#ff7a00,#ff3d71);color:white}.hero{padding:58px 7vw 36px;background:radial-gradient(circle at 70% 20%,#ffe7ba,transparent 32%),linear-gradient(135deg,#fff7ed,#eef6ff)}.hero h1{font-size:clamp(34px,6vw,68px);margin:10px 0}.hero p{max-width:680px;color:#526071;line-height:1.7}.eyebrow{color:#ff6a00;font-weight:700}.search{max-width:760px;background:white;border-radius:22px;padding:12px;display:flex;gap:10px;box-shadow:0 20px 60px rgba(255,106,0,.16)}.search input{flex:1;border:0;outline:0;font-size:16px}.grid{padding:30px 7vw;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px}article{background:white;border-radius:20px;padding:22px;box-shadow:0 14px 38px rgba(15,23,42,.08)}article span{font-size:34px}article p{color:#64748b}.panel{margin:0 7vw 50px;background:#111827;color:white;border-radius:24px;padding:24px}.panel div{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.panel b{background:rgba(255,255,255,.12);border-radius:16px;padding:18px;text-align:center}@media(max-width:640px){.topbar{height:auto;padding:14px 18px;align-items:flex-start;gap:12px;flex-direction:column}.hero{padding:34px 18px}.search{flex-wrap:wrap}.search input{min-width:160px}.grid{padding:20px 18px}.panel{margin:0 18px 32px}.panel div{grid-template-columns:repeat(2,1fr)}}`,
    },
  };
}

export async function completeTruncatedUiReply(
  cfg: AIProviderConfig,
  messages: Array<{ role: string; content: string }>,
  partialReply: string,
  maxAttempts = 3,
): Promise<{ reply: string; finishReason?: string; attempts: number }> {
  let reply = partialReply;
  let finishReason: string | undefined = "length";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (parseUiBundleFromReply(reply)) {
      return { reply, finishReason: "stop", attempts: attempt - 1 };
    }
    if (finishReason !== "length" && !isReplyTruncated(reply)) break;

    const res = await chatCompletionNonStream(cfg, {
      model: cfg.model,
      messages: [
        ...messages,
        { role: "assistant", content: reply },
        {
          role: "user",
          content:
            "继续上一次输出：不要重写、不要解释、不要从头开始，只从被截断的位置继续补完同一个 ```uibundle JSON 代码块，直到 JSON 和代码块都闭合。",
        },
      ],
      temperature: 0.2,
    });

    if (!res.ok) break;
    const json = (await res.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> }
      | null;
    const choice = json?.choices?.[0];
    const next = choice?.message?.content ?? "";
    finishReason = choice?.finish_reason;
    if (!next.trim()) break;
    reply += next;
  }

  return { reply, finishReason, attempts: maxAttempts };
}

export async function repairUiReplyToBundle(
  cfg: AIProviderConfig,
  originalPrompt: string,
  brokenReply: string,
): Promise<{ reply: string; bundle: UiBundle | null }> {
  const repairPrompt = `把下面被截断/格式错误的网页生成结果修复成一个可运行的 UI bundle JSON。只输出 JSON，不要 Markdown，不要解释。用户需求：${originalPrompt}\n\n坏结果：\n${brokenReply.slice(0, 24000)}`;
  const res = await chatCompletionNonStream(cfg, {
    model: cfg.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT + "\n修复模式：最终只返回 JSON 对象本身，不要代码围栏。" },
      { role: "user", content: repairPrompt },
    ],
    temperature: 0.1,
  });
  if (!res.ok) return { reply: brokenReply, bundle: null };
  const json = (await res.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  const content = json?.choices?.[0]?.message?.content ?? "";
  const bundle = parseUiBundleFromReply(content);
  return { reply: content ? `已修复并生成可预览网页。\n\n\`\`\`uibundle\n${JSON.stringify(bundle ?? parseBundleFromText(content), null, 2)}\n\`\`\`` : brokenReply, bundle };
}

function buildAppShell(routes: PlannedRoute[], theme: PreviewTheme, brand: string): string {
  const imports = routes.map((_r, i) => `import Page${i} from './pages/Page${i}';`).join("\n");
  const routeJsx = routes
    .map((r, i) => `        <Route path="${r.path}" element={<Page${i} />} />`)
    .join("\n");
  const navJsx = routes
    .map((r) => `<Link key="${r.path}" to="${r.path}" className={loc.pathname === '${r.path}' ? 'active' : ''}>${r.label}</Link>`)
    .join("");
  const footLinks = routes.slice(0, 5).map((r) => `<li><Link to="${r.path}">${r.label}</Link></li>`).join("");
  return `import { Routes, Route, Link, useLocation } from 'react-router-dom';
import './styles.css';
${imports}

function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="brand">${brand}</Link>
        <nav>${navJsx}</nav>
        <Link to="${routes[routes.length - 1]?.path ?? "/"}" className="primary" style={{padding:'8px 14px'}}>开始使用</Link>
      </header>
      {children}
      <footer className="sitefoot">
        <div className="cols">
          <div>
            <h4>${brand}</h4>
            <p style={{margin:0,lineHeight:1.6}}>${theme.label} 风格 · AI 一键生成的产品站点，结构清晰、视觉精致。</p>
          </div>
          <div><h4>产品</h4><ul>${footLinks}</ul></div>
          <div><h4>资源</h4><ul><li><a href="#">文档</a></li><li><a href="#">更新日志</a></li><li><a href="#">帮助中心</a></li></ul></div>
          <div><h4>公司</h4><ul><li><a href="#">关于我们</a></li><li><a href="#">联系</a></li><li><a href="#">加入我们</a></li></ul></div>
        </div>
        <div className="copy"><span>© 2026 ${brand}. All rights reserved.</span><span>Powered by AI</span></div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
${routeJsx}
        <Route path="*" element={<Page0 />} />
      </Routes>
    </Layout>
  );
}
`;
}

async function generateOnePage(
  cfg: AIProviderConfig,
  route: PlannedRoute,
  allRoutes: PlannedRoute[],
  theme: PreviewTheme,
  brand: string,
  prompt: string,
  context: string,
  backendHint = "",
): Promise<string> {
  const sys = `你是 Vercel / Linear / Stripe 级别的资深前端设计师 + React 工程师。你只输出**一个 React 函数组件**的完整 .tsx 源码（默认导出），不要 Markdown，不要解释，不要 import './styles.css'，不要 import 路由库（路由由外层 App 处理）。可以 import React、useState/useEffect 等。`;
  const user = `为「${brand}」生成单个页面组件：${route.label}（${route.path}）。

页面意图：${route.brief}

【强制视觉规范——违反任何一条都视为失败】
1. 体量：组件 60-200 行，至少 4 个明显的视觉区块。
2. 顶部 <section className="pagehead">：<p className="eyebrow">小标签</p> + <h1>真实主标题</h1> + <p className="lead">2 行副标题</p> + .actions 里放 1 个 .primary + 1 个 .ghost 按钮。
3. 然后从下列区块**至少选 3 种组合**，按页面意图取舍：
   - .stats（4 个数据卡，含 .k 标签 / .v 数值 / <small>+12%</small> 趋势）
   - .grid（6-9 个 .card，每张含 <img className="cover" src="https://picsum.photos/seed/xxx/600/400" /> + h3 + p + .row 含 .price 和 .ghost 按钮 或 .tag）
   - .features（4-6 个 .feature，每个含 .icon emoji + h3 + p）
   - .listcard（5-8 个 .listitem，每个 .avatar emoji + .body 含 .title + .meta + .right）
   - .tablecard（带 table，5-8 行真实数据，状态用 .tag.ok/.warn/.gray）
   - .formcard（label + input + select + .primary 提交按钮）
   - .panel（深色 CTA 面板，含 h2 + p + .panel-grid 4 项）
4. 文案：**真实中文业务文案**，禁止 Lorem / "示例" / "Demo"。卡片标题、价格、人名、地名、商品名、统计数字都要具体、有差异、像真站。
5. 图：商品/封面统一 <img className="cover" src={"https://picsum.photos/seed/"+seed+"/600/400"} alt={...} />，每张 seed 都不同。
6. 不要全屏渐变，不要超大孤立 h1，不要满屏只用一种 emoji，不要空白卡片。
7. 1-2 处用 <span className="gradtxt">关键词</span> 给标题加渐变高亮。
8. 不要写 import './styles.css'，不要写 BrowserRouter / Routes / Route，只 export default function ...()。

可用 CSS 类（已注入，只能用这些 + 必要内联样式）：
topbar/brand/page/pagehead/eyebrow/lead/hero/section/section-title/stats/stat/grid/cards/products/card/cover/categories/category/features/feature/listcard/listitem/avatar/formcard/tablecard/tag/tag.ok/tag.warn/tag.gray/panel/panel-grid/searchbar/search/primary/ghost/cta/gradtxt/glow/sitefoot

当前主题：${theme.label}（主色 ${theme.brand}，强调色 ${theme.accent}）。
其它已有页面：${allRoutes.filter((r) => r.path !== route.path).map((r) => `${r.label}(${r.path})`).join("、") || "无"}
用户原始需求：${prompt}
${context ? `\n历史上下文：${context.slice(0, 1500)}` : ""}
${backendHint}

直接输出 .tsx 源码：`;

  const res = await chatCompletionNonStream(cfg, {
    model: cfg.model,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    temperature: 0.75,
  });
  const fallback = `export default function Page() { return <section className="pagehead"><p className="eyebrow">${route.label}</p><h1>${route.label}</h1><p className="lead">${route.brief}</p></section>; }`;
  if (!res.ok) return fallback;
  const json = (await res.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  let code = stripCodeFence(json?.choices?.[0]?.message?.content ?? "").trim();
  code = code.replace(/^\s*import\s+['"]\.\/styles\.css['"];?\s*$/gm, "");
  code = code.replace(/^\s*import\s+\{[^}]*\}\s+from\s+['"]react-router-dom['"];?\s*$/gm, "");
  if (!/export\s+default/.test(code)) return fallback;
  return code;
}

export async function generateSegmentedUiBundle(
  cfg: AIProviderConfig,
  prompt: string,
  messages?: Array<{ role: string; content: string }>,
): Promise<{ reply: string; bundle: UiBundle | null; finishReason: string }> {
  const context = compactGenerationContext(messages);

  // ===== Plan-first：检测后端能力，未确认就先抛 plan 卡片 =====
  const detected = detectBackendNeeds(prompt);
  const confirmed = isPlanConfirmed(messages);
  if (detected.needsBackend && !confirmed) {
    return {
      reply: renderPlanMessage(detected.recipes),
      bundle: null,
      finishReason: "needs_backend_plan",
    };
  }

  // 已确认 → 把方案 prompt 片段注入到后续 page 生成
  let backendHint = "";
  if (detected.needsBackend && confirmed) {
    const lastUser = [...(messages ?? [])].reverse().find((m) => m.role === "user")?.content ?? prompt;
    const picks = extractConfirmedOptions(detected.recipes, lastUser);
    if (picks.length) {
      backendHint =
        "\n\n## 后端实现要求（客户已确认方案，必须严格按此实现）\n" +
        picks.map((p) => `- ${p.option.label}：${p.option.promptHint}`).join("\n");
    }
  }

  const planRes = await chatCompletionNonStream(cfg, {
    model: cfg.model,
    messages: [
      { role: "system", content: "你是产品信息架构规划器。只输出 JSON，不要 Markdown。brief 写清这一页要展示什么（≥20 字）。" },
      {
        role: "user",
        content:
          `为这个 AI 生成网站需求规划 3-6 个页面路由（首页最丰富，其它各司其职）。结合历史上下文做增量修改，保留已有页面。输出格式：{"routes":[{"path":"/","label":"首页","brief":"≥20字"}]}。\n历史上下文：${context || "无"}\n最新需求：${prompt}`,
      },
    ],
    temperature: 0.2,
  });
  const planJson = planRes.ok ? await planRes.json().catch(() => null) : null;
  const planContent = (planJson as { choices?: Array<{ message?: { content?: string } }> } | null)?.choices?.[0]?.message?.content ?? "";
  const routes = normalizePlannedRoutes(parseAnyJsonObject(planContent), prompt).slice(0, 6);

  const theme = inferTheme(prompt, context);
  const brandMatch = prompt.match(/(飞猪|淘宝|天猫|京东|拼多多|美团|饿了么|抖音|小红书|Bilibili|微信|支付宝|Apple|Notion|GitHub|Starbucks|麦当劳)/i);
  const brand = brandMatch?.[1] ?? theme.label;

  // 关键改动：并行生成每一页，每页独立模型调用 → 内容密度远高于单文件
  const pageCodes = await Promise.all(
    routes.map((r) => generateOnePage(cfg, r, routes, theme, brand, prompt, context, backendHint)),
  );

  const files: Record<string, string> = {
    "/App.tsx": buildAppShell(routes, theme, brand),
    "/styles.css": themedPreviewCss(theme),
  };
  routes.forEach((_, i) => {
    files[`/pages/Page${i}.tsx`] = pageCodes[i];
  });

  const bundle = uiBundleSchema.safeParse({
    routes: routes.map(({ path, label }) => ({ path, label })),
    files,
  });
  if (!bundle.success) return { reply: "", bundle: null, finishReason: "bundle_invalid" };
  return {
    reply: `已生成可预览网页（${routes.length} 页，每页独立生成以提升质量）。\n\n\`\`\`uibundle\n${JSON.stringify(bundle.data, null, 2)}\n\`\`\``,
    bundle: { ...bundle.data, files: patchReactImports(bundle.data.files) },
    finishReason: "segmented_parallel",
  };
}

export async function persistGenerationResult(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  reply: string,
  _fallbackPrompt?: string,
  finishReason?: string,
) {
  let bundle = parseUiBundleFromReply(reply);
  if (!bundle && _fallbackPrompt && finishReason === "force_fallback") bundle = deterministicBundle(_fallbackPrompt);
  if (bundle) bundle = { ...bundle, files: patchReactImports(bundle.files) };

  let savedReply = reply;
  if (!bundle && finishReason !== "needs_backend_plan") {
    if (finishReason === "length" || isReplyTruncated(reply)) {
      savedReply =
        "⚠️ 生成失败：模型多次续写后仍未返回完整代码，已记录失败原因。";
    } else {
      savedReply =
        "⚠️ 生成失败：未能从模型回复中解析到合法的项目 JSON。请重试或换一种描述。";
    }
  }

  const { error: messageError } = await supabase.from("messages").insert({
    project_id: projectId,
    user_id: userId,
    role: "assistant",
    content: savedReply,
  });
  if (messageError) {
    throw new Error(`保存对话失败：${messageError.message}`);
  }

  if (bundle) {
    const { error: projectError } = await supabase
      .from("projects")
      .update({
        preview_sandpack: bundle as unknown as Json,
        preview_html: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    if (projectError) {
      throw new Error(`保存预览失败：${projectError.message}`);
    }
  }

  return { reply: savedReply, sandpack: bundle };
}
