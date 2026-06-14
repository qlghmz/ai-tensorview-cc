import type { UiBundle } from "@/lib/ui-bundle";
import { sanitizeUiBundle } from "@/lib/ui-bundle";

const SOURCE_PATHS = ["App.tsx", "pages/", "styles.css", "components/"];

/** Convert repo flat paths back to Sandpack bundle paths. */
export function repoFilesToBundle(files: Record<string, string>): UiBundle | null {
  const bundleFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    const normalized = path.replace(/^src\//, "");
    if (normalized === "index.css" || normalized === "styles.css") {
      bundleFiles["/styles.css"] = content;
      continue;
    }
    if (normalized === "App.tsx" || normalized.startsWith("pages/") || normalized.startsWith("components/")) {
      bundleFiles[`/${normalized}`] = content;
    }
  }
  if (!bundleFiles["/App.tsx"] && files["App.tsx"]) {
    bundleFiles["/App.tsx"] = files["App.tsx"];
  }
  if (Object.keys(bundleFiles).length === 0) return null;

  const routes = inferRoutes(bundleFiles["/App.tsx"] ?? "");
  return sanitizeUiBundle({ routes, files: bundleFiles });
}

function inferRoutes(appSource: string): Array<{ path: string; label: string }> {
  const routes: Array<{ path: string; label: string }> = [];
  const re = /path\s*=\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(appSource))) {
    const path = m[1];
    if (!routes.some((r) => r.path === path)) {
      routes.push({ path, label: path === "/" ? "首页" : path.slice(1) });
    }
  }
  return routes.length ? routes : [{ path: "/", label: "首页" }];
}

export function mergeBundleWithRepoFiles(current: UiBundle | null, pulled: Record<string, string>): UiBundle | null {
  const fromRepo = repoFilesToBundle(pulled);
  if (!fromRepo) return current;
  if (!current) return fromRepo;

  const mergedFiles = { ...current.files, ...fromRepo.files };
  const routeMap = new Map(current.routes.map((r) => [r.path, r]));
  for (const r of fromRepo.routes) routeMap.set(r.path, r);

  return sanitizeUiBundle({
    routes: [...routeMap.values()],
    files: mergedFiles,
  });
}

export function filterRelevantRepoFiles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    const p = path.replace(/^src\//, "");
    if (SOURCE_PATHS.some((s) => p === s || p.startsWith(s))) {
      out[p] = content;
    }
    if (p.endsWith(".tsx") || p.endsWith(".css")) out[p] = content;
  }
  return out;
}
