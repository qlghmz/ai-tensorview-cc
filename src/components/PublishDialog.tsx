import { useState } from "react";
import { Loader2, Check, Copy, Globe, Sparkles, ExternalLink, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LovableBundle } from "@/lib/lovable-bundle";
import { buildPublishedHtml } from "@/lib/publish-snapshot";
import { publishToEdgeOne } from "@/server/edgeone-deploy.functions";

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

/**
 * 「一键发布」对话框 —— 仿 Lovable 的体验：
 *   - 客户不需要登记任何第三方账号
 *   - 点一下，平台代客户把 HTML 推到腾讯云 EdgeOne
 *   - 拿到一个独立的 *.edgeone.app 公开链接，国内可直接访问
 */
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
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"edgeone" | "slug" | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(publishedUrl ?? null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(publicSlug);

  if (!open) return null;

  const slugUrl =
    currentSlug && typeof window !== "undefined"
      ? `${window.location.origin}/s/${currentSlug}`
      : null;

  const deploy = async () => {
    if (!bundle) {
      toast.error("还没有可发布的页面，先生成页面再发布");
      return;
    }
    setBusy(true);
    try {
      // 1) 浏览器侧编译成自包含 HTML
      const html = await buildPublishedHtml(bundle, { title: projectName });

      // 2) 调服务端 -> 腾讯云 EdgeOne，拿独立公网链接
      const res = await publishToEdgeOne({
        data: { projectId, html },
      });

      // 3) 把 HTML 写回数据库 + 设公开 + 没 slug 就生成
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
      toast.success("发布成功，国内可直接访问");

      // 异步通知 IndexNow（必应/Yandex 等），失败不影响发布结果
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
      toast.error(e instanceof Error ? e.message : "发布失败");
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
      toast.error("复制失败");
    }
  };

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
            <div className="text-sm font-semibold">一键发布到公网</div>
            <div className="text-[11px] text-muted-foreground">
              独立域名，国内可访问，无需账号
            </div>
          </div>
        </div>

        {/* 已发布链接 */}
        {currentUrl && (
          <div className="mt-4">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3 text-brand" />
              已发布的公网链接
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
                title="复制链接"
              >
                {copied === "edgeone" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md glass p-1 shrink-0"
                title="打开"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              链接由腾讯云 EdgeOne 提供，完全独立，跟本平台无关
            </div>
          </div>
        )}

        {/* 站内短链 */}
        {slugUrl && (
          <div className="mt-3">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3 text-brand" />
              站内短链（带 TensorView 头部）
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
                title="复制短链"
              >
                {copied === "slug" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
              <a
                href={slugUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md glass p-1 shrink-0"
                title="打开"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* 主操作 */}
        <button
          type="button"
          onClick={deploy}
          disabled={busy || !bundle}
          className="mt-4 w-full rounded-lg btn-brand py-2.5 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "正在发布…" : currentUrl ? "重新部署最新版本" : "立即发布"}
        </button>

        <div className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
          点击发布后，平台会把页面打包推送到腾讯云 EdgeOne，自动给你分配一个独立的
          <span className="text-foreground font-medium"> .edgeone.app </span>
          链接。任何人打开都能直接看到成品页，不需要登录、不依赖本平台。
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg glass px-3 py-1.5 text-xs">
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
