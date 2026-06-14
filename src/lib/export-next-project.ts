import type { UiBundle } from "@/lib/ui-bundle";
import { buildViteProjectFiles } from "@/lib/export-vite-project";

function toAppRouterPath(bundlePath: string): string {
  const p = bundlePath.startsWith("/") ? bundlePath.slice(1) : bundlePath;
  if (p === "App.tsx") return "app/page.tsx";
  if (p.startsWith("pages/")) {
    const rest = p.slice("pages/".length).replace(/\.tsx$/, "");
    if (rest === "Home" || rest === "index") return "app/page.tsx";
    return `app/${rest.toLowerCase()}/page.tsx`;
  }
  if (p === "styles.css") return "app/globals.css";
  return `components/${p.replace(/\//g, "-")}`;
}

export function buildNextProjectFiles(bundle: UiBundle, projectName: string): Record<string, string> {
  const vite = buildViteProjectFiles(bundle, projectName);
  const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase() || "tensorview-app";
  const files: Record<string, string> = {
    "package.json": JSON.stringify(
      {
        name: safeName,
        private: true,
        scripts: { dev: "next dev", build: "next build", start: "next start" },
        dependencies: { next: "^15.0.0", react: "^19.0.0", "react-dom": "^19.0.0" },
        devDependencies: { typescript: "^5.6.0", "@types/node": "^22.0.0", "@types/react": "^19.0.0", tailwindcss: "^4.0.0", "@tailwindcss/postcss": "^4.0.0" },
      },
      null,
      2,
    ),
    "next.config.ts": `import type { NextConfig } from "next";
const config: NextConfig = { reactStrictMode: true };
export default config;`,
    "postcss.config.mjs": `export default { plugins: { "@tailwindcss/postcss": {} } };`,
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          module: "esnext",
          moduleResolution: "bundler",
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./*"] },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
    "app/layout.tsx": `import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "${projectName}" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}`,
    "README.md": vite["README.md"]?.replace("npm run dev", "npm run dev") ?? `# ${projectName}\n\nNext.js export from TensorView.\n`,
  };

  for (const [path, content] of Object.entries(bundle.files)) {
    if (path === "/index.tsx") continue;
    const target = toAppRouterPath(path);
    let code = content;
    if (path === "/App.tsx") {
      code = content
        .replace(/from\s+['"]react-router-dom['"]/g, "from 'next/navigation'")
        .replace(/BrowserRouter|Routes|Route|Link/g, (m) => (m === "Link" ? "Link" : m));
      code = `"use client";\n${code}`;
    }
    files[target] = code;
  }

  if (vite["src/index.css"]) files["app/globals.css"] = vite["src/index.css"];
  if (!files["app/page.tsx"] && bundle.files["/App.tsx"]) {
    files["app/page.tsx"] = `"use client";\nimport App from "@/legacy/App";\nexport default function Page() { return <App />; }\n`;
    files["legacy/App.tsx"] = bundle.files["/App.tsx"];
  }

  return files;
}
