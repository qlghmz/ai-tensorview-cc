import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DOC_ARTICLES } from "@/content/docs-articles";

const HOST = "ai.tensorview.cc";
const BASE_URL = `https://${HOST}`;
const INDEXNOW_KEY = "0f9bbbf33b9e4b83953a033c97851429";
const KEY_LOCATION = `${BASE_URL}/${INDEXNOW_KEY}.txt`;

/**
 * IndexNow 提交端点。
 * 用法：
 *   GET  /api/public/indexnow            → 提交所有已知的静态页 + 文档 + 最近公开项目
 *   POST /api/public/indexnow { urls:[...] } → 提交自定义 URL 列表
 *
 * 该端点是公开的，但只允许提交本站 URL，且 IndexNow 自身会通过 KEY_LOCATION 校验。
 */
export const Route = createFileRoute("/api/public/indexnow")({
  server: {
    handlers: {
      GET: async () => {
        const urls = await collectAllUrls();
        const result = await submitToIndexNow(urls);
        return Response.json({ ok: true, submitted: urls.length, ...result });
      },
      POST: async ({ request }) => {
        let body: { urls?: unknown } = {};
        try {
          body = (await request.json()) as { urls?: unknown };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!Array.isArray(body.urls) || body.urls.length === 0) {
          return new Response("urls[] required", { status: 400 });
        }
        const urls = body.urls
          .filter((u): u is string => typeof u === "string")
          .filter((u) => u.startsWith(BASE_URL))
          .slice(0, 10000);
        if (urls.length === 0) return new Response("no valid urls", { status: 400 });
        const result = await submitToIndexNow(urls);
        return Response.json({ ok: true, submitted: urls.length, ...result });
      },
    },
  },
});

async function collectAllUrls(): Promise<string[]> {
  const urls: string[] = [
    `${BASE_URL}/`,
    `${BASE_URL}/pricing`,
    `${BASE_URL}/docs`,
    ...DOC_ARTICLES.map((a) => `${BASE_URL}/docs/${a.slug}`),
  ];
  try {
    const { data } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(500);
    for (const p of data ?? []) urls.push(`${BASE_URL}/p/${p.id}`);
  } catch (e) {
    console.error("[indexnow] failed to load projects", e);
  }
  return urls;
}

async function submitToIndexNow(urls: string[]) {
  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: KEY_LOCATION,
        urlList: urls,
      }),
    });
    return { indexnowStatus: res.status };
  } catch (e) {
    console.error("[indexnow] submit failed", e);
    return { indexnowStatus: 0, error: (e as Error).message };
  }
}
