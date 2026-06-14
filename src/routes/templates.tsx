import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { listCommunityTemplates } from "@/lib/share.functions";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { applyStyleToPrompt } from "@/lib/ui-styles";
import { toast } from "sonner";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "模板市场 — TensorView Builder" },
      { name: "description", content: "社区精选 AI 网页模板，一键创建项目" },
    ],
    links: [{ rel: "canonical", href: "https://ai.tensorview.cc/templates" }],
  }),
  component: TemplatesPage,
});

type TemplateRow = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  description: string;
  emoji: string;
  prompt: string;
  style_id: string;
  author: string | null;
  source_url: string | null;
  featured: boolean;
};

function TemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<TemplateRow[] | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    listCommunityTemplates()
      .then((r) => setItems(r.items as TemplateRow[]))
      .catch(() => setItems([]));
  }, []);

  const useTemplate = async (t: TemplateRow) => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setCreating(t.slug);
    try {
      const prompt = applyStyleToPrompt(t.prompt, t.style_id);
      const { data, error } = await supabase
        .from("projects")
        .insert({ user_id: user.id, name: t.name, description: prompt })
        .select("id")
        .single();
      if (error) throw error;
      navigate({ to: "/project/$projectId", params: { projectId: data.id }, search: { initial: prompt } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="min-h-screen relative" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <SiteHeader />
      <main className="relative mx-auto max-w-[1100px] px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            Template Marketplace
          </div>
          <h1 className="text-3xl font-bold mb-2">模板市场</h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            精选社区模板，一键创建项目。欢迎通过{" "}
            <a href="https://github.com/qlghmz/ai-tensorview-cc/blob/main/CONTRIBUTING.md" className="text-brand hover:underline" target="_blank" rel="noreferrer">
              GitHub PR
            </a>{" "}
            贡献新模板。
          </p>
        </div>

        {!items ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((t) => (
              <article key={t.id} className="glass rounded-2xl p-5 flex flex-col">
                <div className="text-3xl mb-2">{t.emoji}</div>
                <h2 className="font-semibold">{t.name}</h2>
                <p className="text-sm text-muted-foreground mt-1 flex-1">{t.description}</p>
                {t.author && <p className="text-[10px] text-muted-foreground mt-2">by {t.author}</p>}
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    disabled={creating === t.slug}
                    onClick={() => useTemplate(t)}
                    className="flex-1 rounded-full btn-brand py-2 text-xs font-medium disabled:opacity-50"
                  >
                    {creating === t.slug ? "创建中…" : "使用模板"}
                  </button>
                  {t.source_url && (
                    <a href={t.source_url} target="_blank" rel="noreferrer" className="rounded-full glass px-3 py-2 text-xs grid place-items-center" title="来源">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="text-center mt-10 text-sm text-muted-foreground">
          内置模板在 <Link to="/dashboard" className="text-brand hover:underline">Dashboard</Link>，社区模板在此页持续更新。
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
