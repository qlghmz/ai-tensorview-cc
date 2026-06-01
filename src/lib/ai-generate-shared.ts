import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  extractLovableFence,
  patchReactImports,
  lovableBundleSchema,
  tryParseLovableBundle,
  type LovableBundle,
} from "@/lib/lovable-bundle";
import { chatCompletionNonStream, type AIProviderConfig } from "@/lib/ai-config";

export const SYSTEM_PROMPT = `你是 Lovable 风格的「全栈 React 网页生成器」——用户用自然语言描述产品界面，你要输出**可运行的多文件 React + TypeScript 项目**（在 Sandpack 里实时预览）。

## 输出格式（必须严格遵守）

1. 先用一句中文（≤30 字）说明你准备生成 / 修改哪些页面。
2. 然后**只输出一个** Markdown 代码块，语言标记必须是 **lovable**，内容为**合法 JSON**（不要夹杂注释、不要有尾逗号），结构如下：

\`\`\`lovable
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

每次回复**只包含一个** \`\`\`lovable\`\`\` 代码块，不要输出第二个代码块。`;

function summarizeSandpackForContext(bundle: LovableBundle, maxPerFile = 1200): string {
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
    const parsedDb = lovableBundleSchema.safeParse(sandpackRow);
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
        "（历史）该项目曾使用单页 HTML 预览；请按 Lovable JSON 规范生成新的 React 多文件项目替换之。旧 HTML 参考：\n```html\n" +
        project.preview_html.slice(0, 8000) +
        "\n```",
    });
  }

  for (const m of history ?? []) {
    const content =
      m.role === "assistant"
        ? m.content.replace(/```lovable[\s\S]*?```/gi, "（生成了一版 React 项目 JSON）")
        : m.content;
    messages.push({ role: m.role, content });
  }
  messages.push({ role: "user", content: prompt });

  return { ok: true, messages, projectId };
}

/** 检测 ```lovable 代码块是否被截断（缺少闭合 ``` 或 JSON 大括号未闭合）。 */
export function isReplyTruncated(reply: string): boolean {
  const open = reply.match(/```lovable\s*\n/i);
  if (!open) return false;
  const after = reply.slice((open.index ?? 0) + open[0].length);
  if (!/```/.test(after)) return true; // 没有闭合
  return false;
}

function parseBundleFromText(text: string): LovableBundle | null {
  const trimmed = text.trim();
  const direct = tryParseLovableBundle(trimmed);
  if (direct) return direct;
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return tryParseLovableBundle(trimmed.slice(first, last + 1));
  return null;
}

export function parseLovableBundleFromReply(reply: string): LovableBundle | null {
  const fenced = extractLovableFence(reply);
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
  return `:root{--bg:${t.bg};--ink:${t.ink};--muted:${t.muted};--line:${t.line};--card:${t.card};--brand:${t.brand};--brand2:${t.brand2};--accent:${t.accent};--radius:${t.radius};--shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px -12px rgba(0,0,0,.1);font-family:${t.font};color:var(--ink);background:var(--bg);line-height:1.55}
*{box-sizing:border-box}body{margin:0;background:${bodyBg};color:var(--ink);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}button,input,textarea,select{font:inherit;color:inherit}
img{max-width:100%;display:block}
.page,.app{min-height:100vh}
.topbar,header{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;padding:14px max(20px,5vw);background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:saturate(140%) blur(12px);border-bottom:1px solid var(--line)}
.brand,.logo{font-size:18px;font-weight:700;letter-spacing:-.01em;color:var(--ink);display:flex;align-items:center;gap:8px;margin-right:auto;white-space:nowrap}
.brand::before,.logo::before{content:"";width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,var(--brand),var(--brand2))}
nav,.links{display:flex;gap:2px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
nav::-webkit-scrollbar,.links::-webkit-scrollbar{display:none}
nav a,nav button,.links a,.tab{flex:0 0 auto;border:0;background:transparent;color:var(--muted);padding:8px 12px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;transition:all .15s ease;white-space:nowrap}
nav a:hover,nav button:hover,.links a:hover{color:var(--ink);background:color-mix(in srgb,var(--brand) 10%,transparent)}
nav a.active,nav button.active,.links a.active,.tab.active{color:var(--brand);background:color-mix(in srgb,var(--brand) 12%,transparent);font-weight:600}
.primary,button.primary,.cta{background:var(--brand);color:#fff;border:0;border-radius:10px;padding:10px 16px;font-weight:600;cursor:pointer;transition:all .15s ease;font-size:14px}
.primary:hover,button.primary:hover,.cta:hover{background:var(--brand2);transform:translateY(-1px)}
.hero{padding:80px max(20px,5vw) 56px;max-width:1200px;margin:0 auto}
.hero h1{font-size:clamp(36px,6vw,68px);line-height:1.05;letter-spacing:-.03em;margin:14px 0 20px;font-weight:700}
.hero p{max-width:640px;color:var(--muted);font-size:clamp(15px,1.6vw,18px);margin:0 0 28px}
.eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);padding:6px 12px;border-radius:999px}
.search,.searchbar{max-width:560px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:6px 6px 6px 14px;display:flex;align-items:center;gap:8px;box-shadow:var(--shadow)}
.search input,.searchbar input{flex:1;border:0;outline:0;background:transparent;padding:10px 0;min-width:120px;font-size:15px}
.search input::placeholder,.searchbar input::placeholder{color:var(--muted)}
.search button,.searchbar button{border:0;border-radius:8px;padding:9px 16px;background:var(--brand);color:#fff;font-weight:600;cursor:pointer;font-size:14px}
.quick,.categories{padding:8px max(20px,5vw) 0;max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px}
.quick button,.category{border:1px solid var(--line);background:var(--card);border-radius:12px;padding:18px 10px;display:flex;flex-direction:column;gap:8px;align-items:center;cursor:pointer;transition:all .15s ease;font-size:13px;color:var(--ink)}
.quick button:hover,.category:hover{border-color:var(--ink);transform:translateY(-2px);box-shadow:var(--shadow)}
.grid,.cards,.products{padding:40px max(20px,5vw);max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.card,article{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:24px;transition:all .2s ease;cursor:pointer}
.card:hover,article:hover{border-color:var(--ink);transform:translateY(-2px);box-shadow:var(--shadow)}
.card h3,article h3{margin:12px 0 6px;font-size:16px;font-weight:600;letter-spacing:-.01em}
.card p,article p{color:var(--muted);line-height:1.6;font-size:14px;margin:0}
.card .icon,article span:first-child{font-size:28px;display:inline-block}
.card button,article button{margin-top:14px;border:1px solid var(--line);background:transparent;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:500;transition:all .15s}
.card button:hover,article button:hover{background:var(--ink);color:#fff;border-color:var(--ink)}
.panel,.service-panel{margin:0 max(20px,5vw) 60px;max-width:1200px;background:var(--ink);color:#fff;border-radius:18px;padding:40px;margin-left:auto;margin-right:auto}
.panel h2,.service-panel h2{font-size:28px;letter-spacing:-.02em;margin:0 0 24px}
.panel-grid,.service-panel div{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.panel-grid>*,.service-panel b{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;text-align:left;font-weight:500}
form input,form textarea,.card input{width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);outline:0;margin:6px 0;font-size:14px;transition:border-color .15s}
form input:focus,form textarea:focus,.card input:focus{border-color:var(--ink)}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line)}
th{color:var(--muted);font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.tag,.badge{display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(0,0,0,.06);font-size:12px;font-weight:500;color:var(--ink)}
@media(max-width:640px){.topbar{padding:12px 16px}.brand,.logo{font-size:16px}nav a,nav button{padding:7px 10px;font-size:13px}.hero{padding:48px 20px 32px}.hero h1{font-size:36px}.grid,.cards,.products{padding:24px 16px;gap:12px}.panel,.service-panel{margin:0 16px 32px;padding:28px 22px}}`;
}

function deterministicBundle(prompt: string): LovableBundle {
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

export async function completeTruncatedLovableReply(
  cfg: AIProviderConfig,
  messages: Array<{ role: string; content: string }>,
  partialReply: string,
  maxAttempts = 3,
): Promise<{ reply: string; finishReason?: string; attempts: number }> {
  let reply = partialReply;
  let finishReason: string | undefined = "length";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (parseLovableBundleFromReply(reply)) {
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
            "继续上一次输出：不要重写、不要解释、不要从头开始，只从被截断的位置继续补完同一个 ```lovable JSON 代码块，直到 JSON 和代码块都闭合。",
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

export async function repairLovableReplyToBundle(
  cfg: AIProviderConfig,
  originalPrompt: string,
  brokenReply: string,
): Promise<{ reply: string; bundle: LovableBundle | null }> {
  const repairPrompt = `把下面被截断/格式错误的网页生成结果修复成一个可运行的 Lovable JSON。只输出 JSON，不要 Markdown，不要解释。用户需求：${originalPrompt}\n\n坏结果：\n${brokenReply.slice(0, 24000)}`;
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
  const bundle = parseLovableBundleFromReply(content);
  return { reply: content ? `已修复并生成可预览网页。\n\n\`\`\`lovable\n${JSON.stringify(bundle ?? parseBundleFromText(content), null, 2)}\n\`\`\`` : brokenReply, bundle };
}

export async function generateSegmentedLovableBundle(
  cfg: AIProviderConfig,
  prompt: string,
  messages?: Array<{ role: string; content: string }>,
): Promise<{ reply: string; bundle: LovableBundle | null; finishReason: string }> {
  const context = compactGenerationContext(messages);
  const planRes = await chatCompletionNonStream(cfg, {
    model: cfg.model,
    messages: [
      { role: "system", content: "你是产品信息架构规划器。只输出 JSON，不要 Markdown。根据用户的增量需求规划可预览网站路由。" },
      {
        role: "user",
        content:
          `为这个 AI 生成网站需求规划 3-7 个页面路由。必须结合历史上下文做增量修改，保留已有页面，并覆盖用户明确提到的页面（如登录、注册、管理员界面、订单、个人中心等）。输出格式：{"routes":[{"path":"/","label":"首页","brief":"..."}]}。path 只能用小写英文短路径。\n历史上下文：${context || "无"}\n最新需求：${prompt}`,
      },
    ],
    temperature: 0.15,
  });
  const planJson = planRes.ok ? await planRes.json().catch(() => null) : null;
  const planContent = (planJson as { choices?: Array<{ message?: { content?: string } }> } | null)?.choices?.[0]?.message?.content ?? "";
  const routes = normalizePlannedRoutes(parseAnyJsonObject(planContent), prompt);

  const theme = inferTheme(prompt, context);
  const appRes = await chatCompletionNonStream(cfg, {
    model: cfg.model,
    messages: [
      { role: "system", content: "你是 Lovable 风格 React 多页面代码生成器。只输出 /App.tsx 的完整源码，不要 Markdown，不要解释。只能使用 react 和 react-router-dom。" },
      {
        role: "user",
        content:
          `生成一个完整可预览多页面网站的 /App.tsx。要求：默认导出 App；必须 import { Routes, Route, Link, useLocation } from 'react-router-dom'；导入 './styles.css'；不要 BrowserRouter；只用 react 和 react-router-dom；代码控制在 260 行内；用数据数组 map 减少体积；中文真实文案；每个 Route 都要渲染明显不同的完整页面，不能只用 tab 切换；导航 Link 必须覆盖全部 routes；如果有登录/注册/管理后台必须是独立页面；要结合历史上下文保留已有站点主题和已生成页面。\n视觉风格指引（不要固定一种风格，按需求自适应）：\n- 如果用户要求"仿站/克隆/复刻"某个真实产品（如飞猪、淘宝、京东、抖音、小红书、Notion、Apple 等），必须模仿该品牌的真实视觉：标志性主色、Logo 色、典型布局（如电商首页用卡片瀑布流 + 促销 Banner，旅游站点用大图轮播 + 搜索框）、文案语气。\n- 否则按用户描述里的关键词推断（"暗黑/科技/极客"用深色背景，"复古/文艺"用米黄+衬线字，"儿童/教育"用糖果色，"金融/政务"用稳重蓝/灰）。\n- 不要默认套用黑白极简；只在用户明确要求时才用。\n- styles.css 已经按品牌注入了 CSS 变量 --bg/--ink/--brand/--accent，App.tsx 里尽量用语义类（.hero/.card/.grid/.primary/.eyebrow）和 CSS 变量，可以用少量内联样式做差异化。\n当前推断主题：${theme.label}（主色 ${theme.brand}，背景 ${theme.bg}）。\nroutes=${JSON.stringify(routes)}\n历史上下文：${context || "无"}\n最新需求：${prompt}`,
      },
    ],
    temperature: 0.55,
  });
  if (!appRes.ok) return { reply: "", bundle: null, finishReason: "app_failed" };
  const appJson = (await appRes.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> }
    | null;
  const appCode = stripCodeFence(appJson?.choices?.[0]?.message?.content ?? "");
  const missingRoute = routes.find((r) => !appCode.includes(`path=\"${r.path}\"`) && !appCode.includes(`path='${r.path}'`));
  if (!appCode.includes("export default") || !appCode.includes("./styles.css") || missingRoute) {
    return { reply: appCode, bundle: null, finishReason: "app_invalid" };
  }

  const cssCode = themedPreviewCss(theme);
  const bundle = lovableBundleSchema.safeParse({ routes: routes.map(({ path, label }) => ({ path, label })), files: { "/App.tsx": appCode, "/styles.css": cssCode } });
  if (!bundle.success) return { reply: appCode + "\n\n" + cssCode, bundle: null, finishReason: "bundle_invalid" };
  return {
    reply: `已生成可预览网页。\n\n\`\`\`lovable\n${JSON.stringify(bundle.data, null, 2)}\n\`\`\``,
    bundle: { ...bundle.data, files: patchReactImports(bundle.data.files) },
    finishReason: "segmented",
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
  let bundle = parseLovableBundleFromReply(reply);
  if (!bundle && _fallbackPrompt && finishReason === "force_fallback") bundle = deterministicBundle(_fallbackPrompt);
  if (bundle) bundle = { ...bundle, files: patchReactImports(bundle.files) };

  let savedReply = reply;
  if (!bundle) {
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
