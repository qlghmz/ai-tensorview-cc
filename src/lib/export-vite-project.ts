import type { UiBundle } from "@/lib/ui-bundle";

function toSrcPath(bundlePath: string): string {
  const p = bundlePath.startsWith("/") ? bundlePath.slice(1) : bundlePath;
  if (p === "App.tsx") return "src/App.tsx";
  if (p.startsWith("pages/")) return `src/${p}`;
  if (p === "styles.css") return "src/index.css";
  return `src/${p}`;
}

export function buildViteProjectFiles(bundle: UiBundle, projectName: string): Record<string, string> {
  const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase() || "tensorview-app";

  const files: Record<string, string> = {
    "package.json": JSON.stringify(
      {
        name: safeName,
        private: true,
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
        },
        dependencies: {
          react: "^19.0.0",
          "react-dom": "^19.0.0",
          "react-router-dom": "^6.28.0",
        },
        devDependencies: {
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
          "@vitejs/plugin-react": "^4.3.0",
          typescript: "^5.6.0",
          vite: "^6.0.0",
          tailwindcss: "^4.0.0",
          "@tailwindcss/vite": "^4.0.0",
        },
      },
      null,
      2,
    ),
    "index.html": `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});`,
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "src/main.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);`,
    "README.md": `# ${projectName}

Exported from [TensorView Builder](https://ai.tensorview.cc).

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
  };

  for (const [path, content] of Object.entries(bundle.files)) {
    if (path === "/index.tsx") continue;
    files[toSrcPath(path)] = content;
  }

  if (!files["src/index.css"] && bundle.files["/styles.css"]) {
    files["src/index.css"] = bundle.files["/styles.css"];
  } else if (!files["src/index.css"]) {
    files["src/index.css"] = `@import "tailwindcss";\n`;
  }

  return files;
}
