import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  extractLovableFence,
  lovableBundleSchema,
  tryParseLovableBundle,
  type LovableBundle,
} from "@/lib/lovable-bundle";

export const SYSTEM_PROMPT = `你是 Lovable 风格的「全栈 React 网页生成器」——用户用自然语言描述产品界面，你要输出**可运行的多文件 React + TypeScript 项目**（在 Sandpack 里实时预览）。

## 输出格式（必须严格遵守）

1. 先用一两句中文说明你准备生成 / 修改哪些页面与组件。
2. 然后**只输出一个** Markdown 代码块，语言标记必须是 **lovable**，内容为**合法 JSON**（不要夹杂注释、不要有尾逗号），结构如下：

\`\`\`lovable
{
  "routes": [
    { "path": "/", "label": "首页" },
    { "path": "/about", "label": "关于" }
  ],
  "files": {
    "/App.tsx": "import { Routes, Route, Link } from 'react-router-dom';\\nimport Home from './pages/Home';\\n...",
    "/pages/Home.tsx": "export default function Home() { ... }",
    "/styles.css": "body { margin:0; ... }"
  }
}
\`\`\`

## JSON 字段要求

- **routes**：至少 1 条；**path** 必须以 \`/\` 开头；**label** 为中文或简短英文，用于预览切换下拉框。
- **files**：键为**绝对路径**（必须以 \`/\` 开头），值是**完整文件源码字符串**（换行用 \\n 写在 JSON 里）。
- **必须包含** \`/App.tsx\`：默认导出 \`App\`，内部使用 **react-router-dom** 的 \`<Routes>\`、\`<Route>\`、\`<Link>\` 或 \`<NavLink>\`，与 **routes** 一致。
- **不要**在 \`/App.tsx\` 外层再包 \`BrowserRouter\` / \`HashRouter\` / \`MemoryRouter\`（运行环境会由宿主注入 \`MemoryRouter\`）。
- **入口** \`/index.tsx\` **不要**输出，由宿主覆盖。
- 可使用 **\`/styles.css\`** 写全局样式；可配合 **Tailwind** 类名（预览已注入 Tailwind CDN）。
- 依赖**仅限**：react、react-dom、react-router-dom（均为模板已有或可解析版本）；**不要**引用其它 npm 包。
- **每个 .tsx / .jsx 文件中，凡用到 \`useState\` / \`useEffect\` / \`useRef\` / \`useMemo\` / \`useCallback\` / \`useContext\` / \`Fragment\` 等 React API，必须**：
  - 使用命名导入：\`import { useState, useEffect } from 'react'\`，**或**
  - 写 \`import * as React from 'react'\` 后再用 \`React.useState\`。
- **绝对禁止**直接写 \`React.useState\` / \`React.xxx\` 但没有任何 \`import ... from 'react'\` 语句——这是最常见的运行时错误来源。
- 视觉：深色现代、玻璃拟态、渐变、响应式；文案按用户描述写真实中文，不要用 Lorem。

## 增量修改

若对话里带有「当前项目文件」上下文，必须在**保留未提及文件**的前提下做最小改动；routes 与路由组件保持同步。

每次回复**只包含一个** \`\`\`lovable\`\`\` 代码块（JSON），不要额外输出第二个代码块。`;

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

/**
 * 自动修补 AI 生成代码中常见的 "React is not defined" 问题：
 * - 文件用了 React.xxx 但没有 import React → 注入 `import * as React from 'react'`
 * - 文件用了 useState / useEffect 等裸钩子但没有 import → 注入命名导入
 */
function patchReactImports(files: Record<string, string>): Record<string, string> {
  const HOOKS = [
    "useState", "useEffect", "useRef", "useMemo", "useCallback",
    "useContext", "useReducer", "useLayoutEffect", "useId", "useTransition",
  ];
  const out: Record<string, string> = {};
  for (const [path, raw] of Object.entries(files)) {
    if (!/\.(t|j)sx?$/.test(path)) {
      out[path] = raw;
      continue;
    }
    let code = raw;
    const hasReactNamespaceImport =
      /import\s+\*\s+as\s+React\s+from\s+['"]react['"]/.test(code) ||
      /import\s+React(\s*,\s*\{[^}]*\})?\s+from\s+['"]react['"]/.test(code);

    // 1) 用了 React.xxx 但没 import React
    if (/\bReact\.[A-Za-z_]/.test(code) && !hasReactNamespaceImport) {
      code = `import * as React from 'react';\n` + code;
    }

    // 2) 用了裸 hook 但既没 import 它，也没 React 命名空间
    const namedImportMatch = code.match(/import\s+\{([^}]*)\}\s+from\s+['"]react['"]/);
    const importedNames = new Set(
      (namedImportMatch?.[1] ?? "")
        .split(",")
        .map((s) => s.trim().split(/\s+as\s+/)[0])
        .filter(Boolean),
    );
    const missing = HOOKS.filter(
      (h) => new RegExp(`\\b${h}\\s*\\(`).test(code) && !importedNames.has(h),
    );
    if (missing.length > 0 && !/import\s+\*\s+as\s+React\s+from\s+['"]react['"]/.test(code)) {
      if (namedImportMatch) {
        const merged = Array.from(new Set([...importedNames, ...missing])).join(", ");
        code = code.replace(
          /import\s+\{[^}]*\}\s+from\s+['"]react['"]/,
          `import { ${merged} } from 'react'`,
        );
      } else {
        code = `import { ${missing.join(", ")} } from 'react';\n` + code;
      }
    }
    out[path] = code;
  }
  return out;
}

export async function persistGenerationResult(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  reply: string,
) {
  const fence = extractLovableFence(reply);
  let bundle = fence ? tryParseLovableBundle(fence) : null;

  if (bundle) {
    bundle = { ...bundle, files: patchReactImports(bundle.files) };
  }

  await supabase.from("messages").insert({
    project_id: projectId,
    user_id: userId,
    role: "assistant",
    content: reply,
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

  return { reply, sandpack: bundle };
}
