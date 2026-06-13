// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type PluginOption } from "vite";
import path from "node:path";
import { sandpackSsrStubPlugin } from "./vite-plugin-sandpack-ssr-stub";

/** 将 .env / .env.local 等注入 process.env，供服务端 API 与 server functions 使用 */
function serverEnvPlugin(): PluginOption {
  return {
    name: "server-env-loader",
    config(_unused, { mode }) {
      Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
    },
  };
}

export default defineConfig({
  // 本地自托管 Cloudflare 部署需开启 nitro（Lovable 沙箱内会自动启用）
  nitro: true,
  vite: {
    plugins: [serverEnvPlugin(), sandpackSsrStubPlugin()],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(__dirname, "node_modules/entities"),
      },
    },
  },
});
