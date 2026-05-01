import { Link } from "@tanstack/react-router";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { ClientLovableSandpack } from "@/components/lovable/ClientLovableSandpack";
import type { LovableBundle } from "@/lib/lovable-bundle";

export type PublicViewState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "snapshot"; name: string; html: string }
  | { kind: "sandpack"; name: string; bundle: LovableBundle }
  | { kind: "html"; name: string; html: string };

export function PublicProjectView({ state }: { state: PublicViewState }) {
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

  return (
    <div className="h-screen flex flex-col bg-background min-h-0">
      <header className="shrink-0 border-b border-border/40 backdrop-blur-xl bg-background/80 px-4 py-2.5 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="grid h-7 w-7 place-items-center rounded-lg btn-brand">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-bold">特挠率i额外</span>
        </Link>
        <div className="text-xs text-muted-foreground">·</div>
        <div className="text-sm font-medium truncate flex-1">{state.name}</div>
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="rounded-full btn-brand px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1"
        >
          自己也做一个 <ExternalLink className="h-3 w-3" />
        </Link>
      </header>
      {state.kind === "snapshot" || state.kind === "html" ? (
        <iframe
          srcDoc={state.html}
          title={state.name}
          sandbox="allow-scripts allow-same-origin"
          className="flex-1 border-0 bg-white min-h-0"
        />
      ) : (
        <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-3 overflow-hidden bg-background/40">
          <ClientLovableSandpack bundle={state.bundle} readOnly />
        </div>
      )}
    </div>
  );
}
