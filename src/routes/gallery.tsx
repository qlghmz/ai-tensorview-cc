import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "作品展示 — TensorView Builder" },
      { name: "description", content: "社区公开分享的 AI 生成网页作品" },
    ],
    links: [{ rel: "canonical", href: "https://ai.tensorview.cc/gallery" }],
  }),
  component: GalleryPage,
});

type GalleryItem = {
  id: string;
  name: string;
  description: string | null;
  public_slug: string | null;
  updated_at: string;
  published_url: string | null;
};

function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id, name, description, public_slug, updated_at, published_url")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(48)
      .then(({ data }) => setItems(data ?? []));
  }, []);

  return (
    <div className="min-h-screen relative" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <SiteHeader />
      <main className="relative mx-auto max-w-[1200px] px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            Community Showcase
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">作品展示</h1>
          <p className="mt-3 text-muted-foreground">用户发布并公开的 AI 生成网页</p>
        </div>

        {!items ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center glass rounded-3xl p-12 text-muted-foreground">
            还没有公开作品。在编辑器中点击「发布」并设为公开即可出现在这里。
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => {
              const href = p.public_slug ? `/s/${p.public_slug}` : `/p/${p.id}`;
              return (
                <Link
                  key={p.id}
                  to={href}
                  className="glass rounded-2xl p-5 hover:shadow-[var(--shadow-soft)] hover:border-brand/30 transition group block"
                >
                  <div
                    className="aspect-[16/10] rounded-xl mb-4 relative overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, oklch(0.92 0.08 350), oklch(0.88 0.1 295))",
                    }}
                  >
                    <div className="absolute inset-0 bg-grid opacity-30" />
                    <div className="absolute bottom-2 right-2 rounded-lg glass px-2 py-1 text-[10px] opacity-0 group-hover:opacity-100 transition">
                      预览
                    </div>
                  </div>
                  <div className="font-semibold truncate">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</div>
                  )}
                  <div className="mt-3 flex items-center gap-1 text-xs text-brand">
                    <ExternalLink className="h-3 w-3" />
                    打开作品
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
