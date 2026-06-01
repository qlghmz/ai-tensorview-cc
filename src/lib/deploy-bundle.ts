import type { LovableBundle } from "@/lib/lovable-bundle";

/**
 * 从 LovableBundle 中抽出 api/*.ts(x) / api/*.js(x) 文件，部署时随静态页一起推到 Vercel。
 * 安全：浏览器端调用即可，不涉及任何密钥。
 */
export function extractApiFiles(
  bundle: LovableBundle | null,
): Record<string, string> | undefined {
  if (!bundle) return undefined;
  const out: Record<string, string> = {};
  for (const [path, src] of Object.entries(bundle.files)) {
    const clean = path.replace(/^\/+/, "");
    if (clean.startsWith("api/") && /\.(t|j)sx?$/.test(clean)) {
      out[clean] = src;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function hasApiFiles(bundle: LovableBundle | null): boolean {
  return !!extractApiFiles(bundle);
}
