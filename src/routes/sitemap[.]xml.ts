import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE_URL = "https://ai.tensorview.cc";

interface Entry {
  path: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: Entry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/pricing", changefreq: "monthly", priority: "0.8" },
          { path: "/docs", changefreq: "monthly", priority: "0.6" },
        ];

        // 公开的项目快照页（/p/:projectId）
        try {
          const { data } = await supabaseAdmin
            .from("projects")
            .select("id, updated_at")
            .eq("is_public", true)
            .order("updated_at", { ascending: false })
            .limit(500);
          for (const p of data ?? []) {
            entries.push({
              path: `/p/${p.id}`,
              lastmod: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
              changefreq: "weekly",
              priority: "0.5",
            });
          }
        } catch (e) {
          console.error("[sitemap] failed to load projects", e);
        }

        const urls = entries
          .map((e) =>
            [
              "  <url>",
              `    <loc>${BASE_URL}${e.path}</loc>`,
              e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : "",
              e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : "",
              e.priority ? `    <priority>${e.priority}</priority>` : "",
              "  </url>",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
