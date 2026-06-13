import { z } from "zod";

/** Stored in `projects.preview_sandpack` — multi-file React bundle for Sandpack preview. */
export const uiRouteSchema = z.object({
  path: z.string().min(1),
  label: z.string().min(1),
});

export const uiBundleSchema = z.object({
  routes: z.array(uiRouteSchema).min(1),
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

export type UiBundle = z.infer<typeof uiBundleSchema>;

export function tryParseUiBundle(raw: string): UiBundle | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const json = JSON.parse(trimmed) as unknown;
    const r = uiBundleSchema.safeParse(json);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Extract ```uibundle ... ``` fenced JSON (also accepts legacy ```lovable fences). */
export function extractUiBundleFence(full: string): string | null {
  const openRe = /```(?:uibundle|lovable)\s*\n/gi;
  let fallback: string | null = null;
  let open: RegExpExecArray | null;

  while ((open = openRe.exec(full))) {
    const bodyStart = open.index + open[0].length;
    let searchFrom = bodyStart;
    while (true) {
      const close = full.indexOf("```", searchFrom);
      if (close === -1) break;
      const body = full.slice(bodyStart, close).trim();
      if (body.startsWith("{")) {
        fallback ??= body;
        if (tryParseUiBundle(body)) return body;
      }
      searchFrom = close + 3;
    }
  }

  return fallback;
}

export function bundleSignature(b: UiBundle): string {
  return `${b.routes.map((r) => r.path).join("|")}:${Object.keys(b.files).sort().join(",")}:${b.files["/App.tsx"]?.length ?? 0}`;
}

export function normalizeBundlePaths(bundle: UiBundle): UiBundle {
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(bundle.files)) {
    const key = k.startsWith("/") ? k : `/${k}`;
    files[key] = v;
  }
  return { routes: bundle.routes, files };
}

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

function escapeStrayLtInJsxText(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, code] of Object.entries(files)) {
    if (!/\.(t|j)sx$/.test(path)) {
      out[path] = code;
      continue;
    }
    let prev = code;
    let next = code.replace(/>([^<>{}]*?)<(\d)/g, (_m, text: string, digit: string) => `>${text}&lt;${digit}`);
    while (next !== prev) {
      prev = next;
      next = next.replace(/>([^<>{}]*?)<(\d)/g, (_m, text: string, digit: string) => `>${text}&lt;${digit}`);
    }
    out[path] = next;
  }
  return out;
}

export function sanitizeUiBundle(bundle: UiBundle): UiBundle {
  const normalized = normalizeBundlePaths(bundle);
  return { ...normalized, files: escapeStrayLtInJsxText(patchReactImports(normalized.files)) };
}

export function buildSandpackFiles(bundle: UiBundle, memoryInitialPath: string): Record<string, string> {
  const b = sanitizeUiBundle(bundle);
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
