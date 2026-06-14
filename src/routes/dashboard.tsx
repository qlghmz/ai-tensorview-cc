import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Plus, Loader2, Sparkles, ExternalLink, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/site/SiteHeader";
import { RenameProjectDialog } from "@/components/RenameProjectDialog";
import { useI18n } from "@/lib/i18n";
import { pickLang, localizedMeta, localizedLinks } from "@/lib/seo-head";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { StylePicker } from "@/components/StylePicker";
import { PROJECT_TEMPLATES } from "@/lib/project-templates";
import { applyStyleToPrompt } from "@/lib/ui-styles";

const searchSchema = z.object({
  prompt: z.string().optional(),
});

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s) => searchSchema.parse(s),
  loader: ({ context }) => ({ lang: (context as { lang?: "zh" | "en" }).lang ?? "en" }),
  head: ({ loaderData }) => {
    const lang = pickLang(loaderData);
    return {
      meta: [
        ...localizedMeta(lang, "seo.dashboard.title", "seo.dashboard.desc", "/dashboard"),
        { name: "robots", content: "noindex, follow" },
      ],
      links: localizedLinks("/dashboard"),
    };
  },
  component: Dashboard,
});

interface Project {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
}

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { t, lang } = useI18n();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [prompt, setPrompt] = useState(search.prompt ?? "");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [styleId, setStyleId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("projects")
      .select("id, name, description, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(t("dash.toast.loadFail"));
        setProjects(data ?? []);
      });
  }, [user, t]);

  const create = async () => {
    if (!user || !prompt.trim()) return;
    setCreating(true);
    try {
      const name = prompt.slice(0, 40);
      const { data, error } = await supabase
        .from("projects")
        .insert({ user_id: user.id, name, description: prompt })
        .select()
        .single();
      if (error || !data) throw error ?? new Error(t("dash.toast.createFail"));
      const initial = applyStyleToPrompt(prompt.trim(), styleId);
      navigate({ to: "/project/$projectId", params: { projectId: data.id }, search: { initial } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dash.toast.createFail"));
    } finally {
      setCreating(false);
    }
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(t("dash.toast.delFail"));
    setProjects((prev) => prev?.filter((p) => p.id !== id) ?? null);
    toast.success(t("dash.toast.delOk"));
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="relative">
        <SiteHeader />

        <main className="mx-auto max-w-[1100px] px-6 py-10">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold">
              {t("dash.title.1")}<span className="text-gradient">{t("dash.title.2")}</span>{t("dash.title.3")}
            </h1>
            <p className="mt-3 text-muted-foreground">{t("dash.subtitle")}</p>
          </div>

          <div className="mt-8 max-w-2xl mx-auto glass rounded-3xl p-2 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 ml-3 text-brand" />
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !creating && create()}
                placeholder={t("dash.input.placeholder")}
                className="flex-1 bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={create}
                disabled={!prompt.trim() || creating}
                className="rounded-2xl btn-brand px-5 py-3 text-sm font-semibold disabled:opacity-40"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-3 px-2">
              <StylePicker value={styleId} onChange={setStyleId} lang={lang} compact />
            </div>
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">{lang === "zh" ? "从模板开始" : "Start from template"}</h2>
              <Link to="/templates" className="text-sm text-brand hover:underline">
                {lang === "zh" ? "模板市场 →" : "Marketplace →"}
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PROJECT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setPrompt(tpl.prompt);
                    setStyleId(tpl.styleId);
                  }}
                  className="glass rounded-2xl p-4 text-left hover:border-brand/40 hover:shadow-[var(--shadow-soft)] transition"
                >
                  <div className="text-2xl">{tpl.emoji}</div>
                  <div className="mt-2 font-semibold text-sm">{lang === "zh" ? tpl.name : tpl.nameEn}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {lang === "zh" ? tpl.description : tpl.descriptionEn}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Projects */}
          <div className="mt-16">
            <h2 className="text-xl font-semibold mb-5">{t("dash.projects.title")}</h2>
            {projects === null ? (
              <div className="grid place-items-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : projects.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
                {t("dash.projects.empty")}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => (
                  <div key={p.id} className="glass rounded-2xl overflow-hidden group hover:border-brand/40 transition">
                    <Link
                      to="/project/$projectId"
                      params={{ projectId: p.id }}
                      className="block aspect-[16/10] relative"
                      style={{ background: "linear-gradient(135deg, oklch(0.3 0.18 320), oklch(0.25 0.15 295))" }}
                    >
                      <div className="absolute inset-0 bg-grid opacity-20" />
                      <div className="absolute inset-0 grid place-items-center text-2xl font-bold text-white/80">
                        {p.name.slice(0, 1).toUpperCase()}
                      </div>
                      <ExternalLink className="absolute top-3 right-3 h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
                    </Link>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/project/$projectId"
                          params={{ projectId: p.id }}
                          className="flex-1 font-semibold hover:text-brand transition truncate"
                        >
                          {p.name}
                        </Link>
                        <button
                          onClick={() => setRenaming(p)}
                          className="text-muted-foreground hover:text-brand transition"
                          title={t("dash.project.rename")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => del(p.id)}
                          className="text-muted-foreground hover:text-destructive transition"
                          title={t("dash.project.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true, locale: lang === "zh" ? zhCN : enUS })}{t("dash.project.updatedSuffix")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {renaming && (
        <RenameProjectDialog
          open={!!renaming}
          projectId={renaming.id}
          initialName={renaming.name}
          initialDescription={renaming.description}
          onClose={() => setRenaming(null)}
          onSaved={(next) => {
            setProjects((prev) =>
              prev?.map((x) =>
                x.id === renaming.id
                  ? { ...x, name: next.name, description: next.description, updated_at: new Date().toISOString() }
                  : x,
              ) ?? null,
            );
          }}
        />
      )}
    </div>
  );
}
