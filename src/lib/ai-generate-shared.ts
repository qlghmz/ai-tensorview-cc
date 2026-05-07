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

export async function completeTruncatedLovableReply(
  cfg: AIProviderConfig,
  messages: Array<{ role: string; content: string }>,
  partialReply: string,
  maxAttempts = 3,
): Promise<{ reply: string; finishReason?: string; attempts: number }> {
  let reply = partialReply;
  let finishReason: string | undefined = "length";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const fence = extractLovableFence(reply);
    if (fence && tryParseLovableBundle(fence)) {
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

export async function persistGenerationResult(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  reply: string,
  _fallbackPrompt?: string,
  finishReason?: string,
) {
  const fence = extractLovableFence(reply);
  let bundle = fence ? tryParseLovableBundle(fence) : null;
  if (bundle) bundle = { ...bundle, files: patchReactImports(bundle.files) };

  let savedReply = reply;
  if (!bundle) {
    if (finishReason === "length" || isReplyTruncated(reply)) {
      savedReply =
        "⚠️ 生成失败：模型一次输出已达上限，代码被截断。请简化需求（比如先做 1–2 个核心页面），或再发一次让我重试。";
    } else {
      savedReply =
        "⚠️ 生成失败：未能从模型回复中解析到合法的项目 JSON。请重试或换一种描述。";
    }
  }

  await supabase.from("messages").insert({
    project_id: projectId,
    user_id: userId,
    role: "assistant",
    content: savedReply,
  });

  if (bundle) {
    await supabase
      .from("projects")
      .update({
        preview_sandpack: bundle as unknown as Json,
        preview_html: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
  }

  return { reply: savedReply, sandpack: bundle };
}
