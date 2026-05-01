import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { buildPublishedHtml } from "@/lib/publish-snapshot";
import type { LovableBundle } from "@/lib/lovable-bundle";

export type PublicViewState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "snapshot"; name: string; html: string }
  | { kind: "sandpack"; name: string; bundle: LovableBundle }
  | { kind: "html"; name: string; html: string };

/**
 * 公开访问的"成品页"。
 * 设计目标：访问者看到的就是用户做出来的网站本身，不带任何平台外壳。
 * - 有 published_html 快照 → 直接 iframe srcDoc 全屏渲染
 * - 没有快照但有 bundle → 浏览器侧即时编译成 HTML，再 iframe 渲染
 * - 兜底 preview_html → 也直接 iframe
 */
export function PublicProjectView({ state }: { state: PublicViewState }) {
  const [liveHtml, setLiveHtml] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    if (state.kind !== "sandpack") {
      setLiveHtml(null);
      setLiveError(null);
      return;
    }
    let cancelled = false;
    setLiveHtml(null);
    setLiveError(null);
    buildPublishedHtml(state.bundle, { title: state.name })
      .then((html) => {
        if (!cancelled) setLiveHtml(html);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLiveError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.kind === "notfound") {
    return (
      <div className="min-h-screen grid place-items-center px-4" style={{ background: "var(--gradient-hero)" }}>
        <div className="text-center max-w-md glass rounded-3xl p-10">
          <h1 className="text-4xl font-bold text-gradient">404</h1>
          <p className="mt-3 text-sm text-muted-foreground">这个项目不存在，或者作者还没有把它设为公开。</p>
          <Link to="/" className="mt-6 inline-flex rounded-full btn-brand px-5 py-2 text-sm font-semibold">
            回到首页
          </Link>
        </div>
      </div>
    );
  }

  // 决定要喂给 iframe 的 HTML
  let html: string | null = null;
  if (state.kind === "snapshot" || state.kind === "html") {
    html = state.html;
  } else if (state.kind === "sandpack") {
    html = liveHtml;
  }

  if (!html) {
    // sandpack 还在编译，或者编译失败
    return (
      <div className="fixed inset-0 grid place-items-center bg-background">
        {liveError ? (
          <div className="text-center max-w-md px-6">
            <div className="text-sm text-destructive">{liveError}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              建议作者在编辑器里点「生成稳定快照」后再分享。
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载页面…
          </div>
        )}
      </div>
    );
  }

  // 全屏 iframe — 访问者看到的就是干净成品，没有任何平台外壳
  return (
    <iframe
      srcDoc={html}
      title={state.name}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      className="fixed inset-0 w-screen h-screen border-0 bg-white"
    />
  );
}
