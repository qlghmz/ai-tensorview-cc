import type { Plugin } from "vite";

const VIRTUAL = "\0sandpack-react-ssr-stub";

/** 与 LovableSandpack 的 import 列表一致；仅用于 SSR / Node，避免执行 nodebox / cuid（需要 `self`）。 */
const STUB = `
export const defaultDark = {};
export function SandpackProvider() { return null; }
export function SandpackLayout() { return null; }
export function SandpackCodeEditor() { return null; }
export function SandpackPreview() { return null; }
`;

/**
 * Sandpack 在 Node 中会触发 \`self is not defined\`（cuid 浏览器指纹）。
 * 在任意 SSR 解析路径下把包替换为无副作用桩模块。
 */
export function sandpackSsrStubPlugin(): Plugin {
  let isSsrBuild = false;

  return {
    name: "sandpack-ssr-stub",
    enforce: "pre",
    config(_c, env) {
      isSsrBuild = Boolean(env.isSsrBuild);
    },
    resolveId(id, _importer, options) {
      const wantStub = options?.ssr === true || isSsrBuild;
      if (!wantStub) return null;
      if (id === "@codesandbox/sandpack-react" || id.startsWith("@codesandbox/sandpack-react/")) {
        return VIRTUAL;
      }
      return null;
    },
    load(id, options) {
      if (id !== VIRTUAL) return null;
      const wantStub = options?.ssr === true || isSsrBuild;
      if (!wantStub) return null;
      return STUB;
    },
  };
}
