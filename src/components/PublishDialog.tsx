import { useState } from "react";
import { Loader2, Check, Copy, Globe, Sparkles, ExternalLink, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { UiBundle } from "@/lib/ui-bundle";
import { buildPublishedHtml } from "@/lib/publish-snapshot";
import { publishToEdgeOne } from "@/lib/edgeone-deploy.functions";
import { useT, useI18n } from "@/lib/i18n";
import { VercelDeployPanel } from "./publish/VercelDeployPanel";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  isPublic: boolean;
  publicSlug: string | null;
  bundle: UiBundle | null;
  /** 是否已经把页面快照写入数据库（编译过一次） */
  hasSnapshot: boolean;
  onChange: (next: {
    isPublic?: boolean;
    publicSlug?: string | null;
    hasSnapshot?: boolean;
    publishedUrl?: string | null;
  }) => void;
  /** 之前部署得到的 edgeone 链接（如果有） */
  publishedUrl?: string | null;
}

type Tab = "edgeone" | "vercel";

export function PublishDialog({
  open,
  onClose,
  projectId,
  projectName,
  publicSlug,
  bundle,
  onChange,
  publishedUrl,
}: Props) {
  const t = useT();
  const { lang } = useI18n();
  const [tab, setTab] = useState<Tab>(lang === "zh" ? "edgeone" : "vercel");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/50 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 pt-6 pb-5 border-b border-border/40" style={{ background: "var(--gradient-glow)" }}>
          <div className="absolute inset-0 bg-grid opacity-15 pointer-events-none" />
          <div className="relative flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl btn-brand shadow-[var(--shadow-glow)] shrink-0">
              <Rocket className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-base font-semibold">{t("publish.title")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("publish.sub")}</div>
              <div className="text-[11px] text-muted-foreground/80 mt-1 truncate">{projectName}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg glass px-2 py-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/40 p-1 text-xs">
            {(["edgeone", "vercel"] as Tab[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-lg py-2 transition ${
                  tab === k ? "btn-brand font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(k === "edgeone" ? "publish.tab.edgeone" : "publish.tab.vercel")}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === "edgeone" ? (
              <EdgeOnePanel
                projectId={projectId}
                projectName={projectName}
                publicSlug={publicSlug}
                bundle={bundle}
                publishedUrl={publishedUrl ?? null}
                onChange={onChange}
              />
            ) : (
              <VercelDeployPanel projectId={projectId} projectName={projectName} bundle={bundle} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- EdgeOne 子面板（原有逻辑） -----------------

function EdgeOnePanel({
  projectId,
  projectName,
  publicSlug,
  bundle,
  publishedUrl,
  onChange,
}: {
  projectId: string;
  projectName: string;
  publicSlug: string | null;
  bundle: UiBundle | null;
  publishedUrl: string | null;
  onChange: Props["onChange"];
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"edgeone" | "slug" | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(publishedUrl);
  const [currentSlug, setCurrentSlug] = useState<string | null>(publicSlug);

  const slugUrl =
    currentSlug && typeof window !== "undefined"
      ? `${window.location.origin}/s/${currentSlug}`
      : null;

  const deploy = async () => {
    if (!bundle) {
      toast.error(t("publish.edgeone.noBundle"));
      return;
    }
    setBusy(true);
    try {
      const html = await buildPublishedHtml(bundle, { title: projectName });

      const res = await publishToEdgeOne({
        data: { projectId, html },
      });

      let nextSlug = currentSlug;
      if (!nextSlug) {
        const { data: slugRow } = await supabase.rpc("generate_project_slug");
        if (typeof slugRow === "string") nextSlug = slugRow;
      }
      await supabase
        .from("projects")
        .update({
          published_html: html,
          is_public: true,
          ...(nextSlug ? { public_slug: nextSlug } : {}),
        })
        .eq("id", projectId);

      setCurrentUrl(res.url);
      setCurrentSlug(nextSlug);
      onChange({
        isPublic: true,
        publishedUrl: res.url,
        publicSlug: nextSlug,
        hasSnapshot: true,
      });
      toast.success(t("publish.edgeone.successToast"));

      void fetch("/api/public/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [
            `https://ai.tensorview.cc/p/${projectId}`,
            ...(nextSlug ? [`https://ai.tensorview.cc/s/${nextSlug}`] : []),
          ],
        }),
      }).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "deploy failed");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, key: "edgeone" | "slug") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(t("publish.copyFailed"));
    }
  };

  const isValidDeployUrl = (u: string | null): u is string =>
    !!u && /^https:\/\/[^/]+\.edgeone\.(app|site|run)(\/|$)/i.test(u);
  const showDeployUrl = isValidDeployUrl(currentUrl);

  return (
    <div className="space-y-3">
      {currentUrl && !showDeployUrl && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          上一次部署返回的链接异常（非 EdgeOne 域名），已忽略。请点击下方按钮重新部署。
        </div>
      )}
      {showDeployUrl && (
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Globe className="h-3 w-3 text-brand" />
            {t("publish.edgeone.label")}
          </label>
          <div className="mt-1.5 flex items-center gap-1.5 rounded-xl border border-border/50 bg-background/80 px-3 py-2">
            <input
              readOnly
              value={currentUrl}
              className="flex-1 min-w-0 bg-transparent text-xs outline-none truncate"
            />
            <button
              type="button"
              onClick={() => copy(currentUrl, "edgeone")}
              className="rounded-md btn-brand p-1 shrink-0"
              title={t("publish.copy")}
            >
              {copied === "edgeone" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
            <a
              href={currentUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md glass p-1 shrink-0"
              title={t("publish.open")}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {t("publish.edgeone.note")}
          </div>
        </div>
      )}

      {slugUrl && (
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Globe className="h-3 w-3 text-brand" />
            {t("publish.edgeone.slugLabel")}
          </label>
          <div className="mt-1.5 flex items-center gap-1.5 rounded-xl border border-border/50 bg-background/80 px-3 py-2">
            <input
              readOnly
              value={slugUrl}
              className="flex-1 min-w-0 bg-transparent text-xs outline-none truncate"
            />
            <button
              type="button"
              onClick={() => copy(slugUrl, "slug")}
              className="rounded-md btn-brand p-1 shrink-0"
              title={t("publish.copy")}
            >
              {copied === "slug" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
            <a
              href={slugUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md glass p-1 shrink-0"
              title={t("publish.open")}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={deploy}
        disabled={busy || !bundle}
        className="w-full rounded-xl btn-brand py-3 text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 shadow-[var(--shadow-glow)]"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy
          ? t("publish.edgeone.deploying")
          : currentUrl
            ? t("publish.edgeone.redeploy")
            : t("publish.edgeone.deploy")}
      </button>

      <div className="text-[11px] text-muted-foreground leading-relaxed">
        {t("publish.edgeone.intro")}
      </div>
    </div>
  );
}
