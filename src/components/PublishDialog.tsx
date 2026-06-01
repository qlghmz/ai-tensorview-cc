import { useState } from "react";
import { Loader2, Check, Copy, Globe, Sparkles, ExternalLink, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LovableBundle } from "@/lib/lovable-bundle";
import { buildPublishedHtml } from "@/lib/publish-snapshot";
import { publishToEdgeOne } from "@/server/edgeone-deploy.functions";
import { useT, useI18n } from "@/lib/i18n";
import { VercelDeployPanel } from "./publish/VercelDeployPanel";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  isPublic: boolean;
  publicSlug: string | null;
  bundle: LovableBundle | null;
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
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md glass rounded-2xl p-5 shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg btn-brand">
            <Rocket className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-semibold">{t("publish.title")}</div>
            <div className="text-[11px] text-muted-foreground">{t("publish.sub")}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-muted/30 p-1 text-xs">
          {(["edgeone", "vercel"] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-md py-1.5 transition ${
                tab === k
                  ? "btn-brand font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(k === "edgeone" ? "publish.tab.edgeone" : "publish.tab.vercel")}
            </button>
          ))}
        </div>

        <div className="mt-4">
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
            <VercelDeployPanel
              projectId={projectId}
              projectName={projectName}
              bundle={bundle}
            />
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg glass px-3 py-1.5 text-xs">
            {t("publish.done")}
          </button>
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
  bundle: LovableBundle | null;
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
          <div className="mt-1 flex items-center gap-1 rounded-lg bg-muted/30 px-2 py-1.5">
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
          <div className="mt-1 flex items-center gap-1 rounded-lg bg-muted/30 px-2 py-1.5">
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
        className="w-full rounded-lg btn-brand py-2.5 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
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
