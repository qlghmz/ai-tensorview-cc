import type { UiBundle } from "@/lib/ui-bundle";
import { buildViteProjectFiles } from "@/lib/export-vite-project";

function toVuePath(bundlePath: string): string {
  const p = bundlePath.startsWith("/") ? bundlePath.slice(1) : bundlePath;
  if (p === "App.tsx") return "src/App.vue";
  if (p.startsWith("pages/")) return `src/views/${p.slice(6).replace(/\.tsx$/, ".vue")}`;
  if (p === "styles.css") return "src/assets/main.css";
  return `src/components/${p.replace(/\//g, "-").replace(/\.tsx$/, ".vue")}`;
}

/** Best-effort Vue 3 shell; React TSX is copied as reference stubs for manual port. */
export function buildVueProjectFiles(bundle: UiBundle, projectName: string): Record<string, string> {
  const vite = buildViteProjectFiles(bundle, projectName);
  const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase() || "tensorview-vue";
  const files: Record<string, string> = {
    "package.json": JSON.stringify(
      {
        name: safeName,
        private: true,
        type: "module",
        scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
        dependencies: { vue: "^3.5.0", "vue-router": "^4.4.0" },
        devDependencies: { "@vitejs/plugin-vue": "^5.2.0", typescript: "^5.6.0", vite: "^6.0.0", tailwindcss: "^4.0.0", "@tailwindcss/vite": "^4.0.0" },
      },
      null,
      2,
    ),
    "index.html": `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/><title>${projectName}</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>`,
    "vite.config.ts": `import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({ plugins: [vue(), tailwindcss()] });`,
    "src/main.ts": `import { createApp } from "vue";
import App from "./App.vue";
import "./assets/main.css";
createApp(App).mount("#app");`,
    "src/App.vue": `<script setup lang="ts">
import Home from "./views/Home.vue";
</script>
<template><Home /></template>`,
    "src/views/Home.vue": `<script setup lang="ts"></script>
<template>
  <main class="p-8">
    <h1 class="text-2xl font-bold">${projectName}</h1>
    <p class="text-muted-foreground mt-2">Vue export shell — see react-reference/ for original React source.</p>
  </template>`,
    "README.md": `# ${projectName} (Vue export)\n\nExported from TensorView. Original React TSX is in \`react-reference/\` for porting.\n\n\`\`\`bash\nnpm install && npm run dev\n\`\`\``,
  };

  if (vite["src/index.css"]) files["src/assets/main.css"] = vite["src/index.css"];

  for (const [path, content] of Object.entries(bundle.files)) {
    if (path === "/index.tsx") continue;
    files[`react-reference/${path.startsWith("/") ? path.slice(1) : path}`] = content;
  }

  return files;
}
