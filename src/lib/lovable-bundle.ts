import { z } from "zod";

/** Stored in `projects.preview_sandpack` — Lovable-style multi-file React bundle. */
export const lovableRouteSchema = z.object({
  path: z.string().min(1),
  label: z.string().min(1),
});

export const lovableBundleSchema = z.object({
  routes: z.array(lovableRouteSchema).min(1),
  files: z.record(z.string()).superRefine((files, ctx) => {
    const keys = Object.keys(files);
    if (!keys.some((k) => k.replace(/^\//, "") === "App.tsx" || k === "/App.tsx")) {
      ctx.addIssue({ code: "custom", message: 'files 必须包含 "/App.tsx"' });
    }
    for (const k of keys) {
      if (!k.startsWith("/")) {
        ctx.addIssue({ code: "custom", message: `路径必须以 / 开头: ${k}` });
      }
    }
  }),
});

export type LovableBundle = z.infer<typeof lovableBundleSchema>;

export function tryParseLovableBundle(raw: string): LovableBundle | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const json = JSON.parse(trimmed) as unknown;
    const r = lovableBundleSchema.safeParse(json);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Extract ```lovable ... ``` fenced JSON (trimmed inner text). */
export function extractLovableFence(full: string): string | null {
  const m = full.match(/```lovable\s*\n([\s\S]*?)```/i);
  return m?.[1]?.trim() ?? null;
}

export function bundleSignature(b: LovableBundle): string {
  return `${b.routes.map((r) => r.path).join("|")}:${Object.keys(b.files).sort().join(",")}:${b.files["/App.tsx"]?.length ?? 0}`;
}

export function normalizeBundlePaths(bundle: LovableBundle): LovableBundle {
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(bundle.files)) {
    const key = k.startsWith("/") ? k : `/${k}`;
    files[key] = v;
  }
  return { routes: bundle.routes, files };
}

/**
 * 修复历史/手工编辑/AI 生成代码里最常见的 React API 缺失导入问题。
 * 这里放在 bundle 层，保证保存前和 Sandpack 渲染前都会兜底处理。
 */
export function patchReactImports(files: Record<string, string>): Record<string, string> {
  const REACT_APIS = [
    "useState", "useEffect", "useRef", "useMemo", "useCallback", "useContext",
    "useReducer", "useLayoutEffect", "useId", "useTransition", "useDeferredValue",
    "Fragment", "memo", "forwardRef", "lazy", "createContext",
  ];
  const out: Record<string, string> = {};

  for (const [path, raw] of Object.entries(files)) {
    if (!/\.(t|j)sx?$/.test(path)) {
      out[path] = raw;
      continue;
    }

    let code = raw;
    const hasReactNamespaceImport =
      /import\s+\*\s+as\s+React\s+from\s+['"]react['"];?/.test(code) ||
      /import\s+React(\s*,\s*\{[^}]*\})?\s+from\s+['"]react['"];?/.test(code);

    if (/\bReact\.[A-Za-z_]/.test(code) && !hasReactNamespaceImport) {
      code = `import * as React from 'react';\n${code}`;
    }

    const namedImportMatch = code.match(/import\s+\{([^}]*)\}\s+from\s+['"]react['"];?/);
    const importedNames = new Set(
      (namedImportMatch?.[1] ?? "")
        .split(",")
        .map((s) => s.trim().split(/\s+as\s+/)[0])
        .filter(Boolean),
    );
    const missing = REACT_APIS.filter(
      (api) => new RegExp(`(?<![\\w.])${api}\\s*\\(`).test(code) && !importedNames.has(api),
    );

    if (missing.length > 0 && !/import\s+\*\s+as\s+React\s+from\s+['"]react['"];?/.test(code)) {
      if (namedImportMatch) {
        const merged = Array.from(new Set([...importedNames, ...missing])).join(", ");
        code = code.replace(/import\s+\{[^}]*\}\s+from\s+['"]react['"];?/, `import { ${merged} } from 'react';`);
      } else if (/import\s+React\s*,\s*\{[^}]*\}\s+from\s+['"]react['"];?/.test(code)) {
        code = code.replace(/import\s+React\s*,\s*\{([^}]*)\}\s+from\s+['"]react['"];?/, (_m, names: string) => {
          const merged = Array.from(new Set([...names.split(",").map((s) => s.trim()).filter(Boolean), ...missing])).join(", ");
          return `import React, { ${merged} } from 'react';`;
        });
      } else if (/import\s+React\s+from\s+['"]react['"];?/.test(code)) {
        code = code.replace(/import\s+React\s+from\s+['"]react['"];?/, `import React, { ${missing.join(", ")} } from 'react';`);
      } else {
        code = `import { ${missing.join(", ")} } from 'react';\n${code}`;
      }
    }

    out[path] = code;
  }
  return out;
}

export function sanitizeLovableBundle(bundle: LovableBundle): LovableBundle {
  const normalized = normalizeBundlePaths(bundle);
  return { ...normalized, files: patchReactImports(normalized.files) };
}

/**
 * Sandpack `react-ts` 模板已有入口；我们覆盖 `/index.tsx`，用 MemoryRouter 固定初始路由，
 * 便于编辑器外「切换页面预览」只改 initialEntries 即可（整包 remount）。
 */
export function buildSandpackFiles(bundle: LovableBundle, memoryInitialPath: string): Record<string, string> {
  const b = sanitizeLovableBundle(bundle);
  const entriesLiteral = JSON.stringify([memoryInitialPath]);
  const shellIndex = `import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <MemoryRouter initialEntries={${entriesLiteral}} initialIndex={0}>
      <App />
    </MemoryRouter>
  </React.StrictMode>
);
`;
  const out: Record<string, string> = { ...b.files };
  out["/index.tsx"] = shellIndex;
  return out;
}
