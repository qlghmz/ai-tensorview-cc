// @lovable.dev/vite-tanstack-config bundles TanStack Start + Vite plugins — do NOT add duplicates manually
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
  // Self-hosted Cloudflare deploy requires nitro
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
