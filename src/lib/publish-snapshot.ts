/**
 * 把 UiBundle 编译成「自包含、国内可访问」的 HTML 快照。
 *
 * 思路：
 * - 不依赖 codesandbox 在线 bundler（国内不稳定）
 * - 不依赖后端（纯客户端渲染）
 * - 用 esm.sh（有国内 CDN）加载 React/ReactDOM/react-router-dom
 * - 用 @babel/standalone 在浏览器里把 TSX 转成 JS（一次性编译，缓存进 HTML）
 *
 * 编译时机：用户点 "发布" 时在浏览器里执行一次，把结果存到 projects.published_html。
 */

import type { UiBundle } from "./ui-bundle";

declare global {
  interface Window {
    Babel?: {
      transform: (
        code: string,
        opts: { presets?: unknown[]; filename?: string },
      ) => { code: string };
    };
  }
}

// 用 esm.sh，自动跟随 CDN，国内基本可达；Babel 用 jsdelivr CN 镜像兜底。
const ESM_BASE = "https://esm.sh";
const BABEL_URL = "https://cdn.jsdelivr.net/npm/@babel/standalone@7.25.6/babel.min.js";

async function loadBabel(): Promise<NonNullable<Window["Babel"]>> {
  if (typeof window === "undefined") throw new Error("snapshot 只能在浏览器执行");
  if (window.Babel) return window.Babel;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = BABEL_URL;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("加载 Babel 失败"));
    document.head.appendChild(s);
  });
  if (!window.Babel) throw new Error("Babel 未加载");
  return window.Babel;
}

function transformTsx(babel: NonNullable<Window["Babel"]>, src: string, filename: string): string {
  return babel.transform(src, {
    filename,
    presets: [
      ["typescript", { allExtensions: true, isTSX: true }],
      ["react", { runtime: "classic" }],
      ["env", { targets: { esmodules: true } }],
    ],
  }).code;
}

/**
 * 把 bundle.files 里的相对 import 重写到运行时 import map 的虚拟模块名上。
 * 我们用 import map 把每个用户文件映射成一个 blob: URL。
 */
function normalizeImportPath(fromFile: string, importPath: string): string {
  // 第三方包：原样保留（让 import map 处理）
  if (!importPath.startsWith(".") && !importPath.startsWith("/")) return importPath;

  const fromDir = fromFile.split("/").slice(0, -1).join("/");
  const segs = (importPath.startsWith("/") ? importPath : `${fromDir}/${importPath}`).split("/");
  const out: string[] = [];
  for (const s of segs) {
    if (!s || s === ".") continue;
    if (s === "..") out.pop();
    else out.push(s);
  }
  let resolved = "/" + out.join("/");

  // 补扩展名
  return resolved;
}

function resolveExt(path: string, files: Record<string, string>): string {
  if (files[path]) return path;
  for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
    if (files[path + ext]) return path + ext;
  }
  for (const ext of ["/index.tsx", "/index.ts", "/index.jsx", "/index.js"]) {
    if (files[path + ext]) return path + ext;
  }
  return path; // 让运行时报错也行
}

/**
 * 生成自包含 HTML。运行时：
 * 1) 加载 React/ReactDOM/react-router-dom from esm.sh
 * 2) 用 import map 把用户文件 blob URL 注册成模块
 * 3) 入口动态 import("/App") → MemoryRouter 包一层渲染
 */
export async function buildPublishedHtml(bundle: UiBundle, options?: { title?: string }): Promise<string> {
  const babel = await loadBabel();

  // 1. 编译每个用户文件，并改写相对 import 路径为绝对 "/xxx.tsx"（绑到 import map）
  const compiled: Record<string, string> = {};
  const files = bundle.files;
  for (const [path, src] of Object.entries(files)) {
    if (path === "/index.tsx") continue;
    const isTs = /\.(t|j)sx?$/.test(path);
    let code = isTs ? transformTsx(babel, src, path) : src;
    // 简单 import 改写：./Foo → /<dir>/Foo.tsx
    code = code.replace(
      /((?:import|export)[^"']*from\s*|import\s*\(\s*)["']([^"']+)["']/g,
      (m, head: string, spec: string) => {
        const norm = normalizeImportPath(path, spec);
        if (!norm.startsWith("/")) return m; // 第三方
        const resolved = resolveExt(norm, files);
        return `${head}"${resolved}"`;
      },
    );
    compiled[path] = code;
  }

  // 2. 序列化代码到 HTML 中：每个文件变成一个 <script type="module-source"> 由运行时转 blob URL
  const filesPayload = JSON.stringify(compiled);

  // 3. 路由初始路径
  const initialPath = bundle.routes[0]?.path ?? "/";
  const title = options?.title ?? "Published Page";

  // 入口代码
  const bootstrap = `
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import App from "/App.tsx";
const root = createRoot(document.getElementById("root"));
root.render(
  React.createElement(React.StrictMode, null,
    React.createElement(MemoryRouter, { initialEntries: ${JSON.stringify([initialPath])}, initialIndex: 0 },
      React.createElement(App, null)
    )
  )
);
`;

  const importMap = {
    imports: {
      react: `${ESM_BASE}/react@18.3.1`,
      "react/jsx-runtime": `${ESM_BASE}/react@18.3.1/jsx-runtime`,
      "react-dom": `${ESM_BASE}/react-dom@18.3.1`,
      "react-dom/client": `${ESM_BASE}/react-dom@18.3.1/client`,
      "react-router-dom": `${ESM_BASE}/react-router-dom@6.28.0?deps=react@18.3.1,react-dom@18.3.1`,
    },
  };

  // 运行时 loader：把 filesPayload 里每个文件转成 blob URL，并用 import map 的 scopes 接管 "/xxx" 的 import
  const runtime = `
(function(){
  const FILES = ${filesPayload};
  const blobs = {};
  for (const path in FILES) {
    blobs[path] = URL.createObjectURL(new Blob([FILES[path]], { type: "text/javascript" }));
  }
  const baseMap = ${JSON.stringify(importMap)};
  baseMap.imports = baseMap.imports || {};
  for (const p in blobs) baseMap.imports[p] = blobs[p];
  const im = document.createElement("script");
  im.type = "importmap";
  im.textContent = JSON.stringify(baseMap);
  document.head.appendChild(im);
  const boot = document.createElement("script");
  boot.type = "module";
  boot.textContent = ${JSON.stringify(bootstrap)};
  document.body.appendChild(boot);
})();
`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>html,body,#root{height:100%;margin:0}body{background:#fff;color:#111}</style>
</head>
<body>
<div id="root"></div>
<script>${runtime}</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}
