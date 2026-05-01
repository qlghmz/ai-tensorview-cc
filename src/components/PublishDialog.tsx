import { useEffect, useState } from "react";
import { Loader2, Check, Copy, Globe, Lock, Sparkles, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LovableBundle } from "@/lib/lovable-bundle";
import { buildPublishedHtml } from "@/lib/publish-snapshot";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  isPublic: boolean;
  publicSlug: string | null;
  bundle: LovableBundle | null;
  hasSnapshot: boolean;
  onChange: (next: { isPublic?: boolean; publicSlug?: string | null; hasSnapshot?: boolean }) => void;
}

export function PublishDialog({
  open,
  onClose,
  projectId,
  projectName,
  isPublic,
  publicSlug,
  bundle,
  hasSnapshot,
  onChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) setSlugInput(publicSlug ?? "");
  }, [open, publicSlug]);

  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const slugUrl = publicSlug ? `${origin}/s/${publicSlug}` : "";
  const fallbackUrl = `${origin}/p/${projectId}`;
  const liveUrl = publicSlug ? slugUrl : fallbackUrl;

  const ensureSlug = async (): Promise<string | null> => {
    if (publicSlug) return publicSlug;
    const { data, error } = await supabase.rpc("generate_project_slug");
    if (error || !data) {
      // 兜底：本地随机
      const fallback = Math.random().toString(36).slice(2, 8);
      const { error: e2 } = await supabase
        .from("projects")
        .update({ public_slug: fallback })
        .eq("id", projectId);
      if (e2) {
        toast.error("生成短链失败");
        return null;
      }
      onChange({ publicSlug: fallback });
      return fallback;
    }
    const { error: upErr } = await supabase
      .from("projects")
      .update({ public_slug: data as string })
      .eq("id", projectId);
    if (upErr) {
      toast.error("写入短链失败");
      return null;
    }
    onChange({ publicSlug: data as string });
    return data as string;
  };

  const togglePublish = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      let nextSlug = publicSlug;
      if (next && !publicSlug) {
        nextSlug = await ensureSlug();
      }
      const { error } = await supabase
        .from("projects")
        .update({ is_public: next })
        .eq("id", projectId);
      if (error) throw error;
      onChange({ isPublic: next, publicSlug: nextSlug });
      toast.success(next ? "已发布，国内可访问" : "已下线");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const buildSnapshot = async () => {
    if (!bundle) {
      toast.error("还没有可发布的页面");
      return;
    }
    setBuilding(true);
    try {
      const html = await buildPublishedHtml(bundle, { title: projectName });
      const { error } = await supabase
        .from("projects")
        .update({ published_html: html })
        .eq("id", projectId);
      if (error) throw error;
      onChange({ hasSnapshot: true });
      toast.success("已生成稳定快照（国内秒开）");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成快照失败");
    } finally {
      setBuilding(false);
    }
  };

  const saveSlug = async () => {
    const v = slugInput.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,32}$/.test(v)) {
      toast.error("短链只能用小写字母、数字、横线，3–32 位");
      return;
    }
    if (v === publicSlug) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ public_slug: v })
        .eq("id", projectId);
      if (error) {
        if (error.code === "23505") toast.error("这个短链已被占用");
        else toast.error(error.message);
        return;
      }
      onChange({ publicSlug: v });
      toast.success("短链已更新");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-semibold">发布到公网</div>
            <div className="text-[11px] text-muted-foreground">国内可直接访问，无需翻墙</div>
          </div>
        </div>

        {/* 开关 */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-2">
            {isPublic ? <Globe className="h-4 w-4 text-brand" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            <div>
              <div className="text-sm font-medium">{isPublic ? "已发布" : "未发布"}</div>
              <div className="text-[11px] text-muted-foreground">
                {isPublic ? "任何人持链接可访问" : "打开后会生成短链"}
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => togglePublish(!isPublic)}
            className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${isPublic ? "bg-brand" : "bg-muted"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${isPublic ? "left-[22px]" : "left-0.5"}`}
            />
          </button>
        </div>

        {isPublic && (
          <>
            {/* 短链 */}
            <div className="mt-4">
              <label className="text-xs text-muted-foreground">访问链接</label>
              <div className="mt-1 flex items-center gap-1 rounded-lg bg-input border border-border px-2 py-1.5">
                <span className="text-[11px] text-muted-foreground shrink-0">{origin}/s/</span>
                <input
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-xs outline-none"
                  placeholder="my-app"
                />
                <button
                  type="button"
                  onClick={saveSlug}
                  disabled={busy || !slugInput.trim() || slugInput.trim() === publicSlug}
                  className="rounded-md btn-brand px-2 py-1 text-[11px] disabled:opacity-40"
                >
                  保存
                </button>
              </div>
              {publicSlug && (
                <div className="mt-2 flex items-center gap-1 rounded-lg bg-muted/30 px-2 py-1.5">
                  <input readOnly value={liveUrl} className="flex-1 min-w-0 bg-transparent text-xs outline-none truncate" />
                  <button type="button" onClick={copy} className="rounded-md btn-brand p-1 shrink-0">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                  <a href={liveUrl} target="_blank" rel="noreferrer" className="rounded-md glass p-1 shrink-0">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            {/* 快照 */}
            <div className="mt-4 rounded-xl border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">国内加速快照</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    把页面预编译成静态 HTML，不依赖 codesandbox bundler，国内秒开
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${hasSnapshot ? "bg-brand/20 text-brand" : "bg-muted text-muted-foreground"}`}
                >
                  {hasSnapshot ? "已生成" : "未生成"}
                </span>
              </div>
              <button
                type="button"
                onClick={buildSnapshot}
                disabled={building || !bundle}
                className="mt-3 w-full rounded-lg btn-brand py-2 text-xs font-medium disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {building ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {building ? "编译中…" : hasSnapshot ? "重新生成快照" : "生成稳定快照"}
              </button>
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg glass px-3 py-1.5 text-xs">
            完成
          </button>
        </div>

        {/* hidden Link to satisfy typed import in some configs */}
        <Link to="/" className="sr-only">home</Link>
      </div>
    </div>
  );
}
