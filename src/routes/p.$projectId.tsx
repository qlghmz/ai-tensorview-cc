import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ExternalLink, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LovableSandpack } from "@/components/lovable/LovableSandpack";
import { lovableBundleSchema, type LovableBundle } from "@/lib/lovable-bundle";

export const Route = createFileRoute("/p/$projectId")({
  component: PublicPreviewPage,
});

type PreviewState =
  | "loading"
  | "notfound"
  | { name: string; kind: "sandpack"; bundle: LovableBundle }
  | { name: string; kind: "html"; html: string };

function PublicPreviewPage() {
  const { projectId } = Route.useParams();
  const [state, setState] = useState<PreviewState>("loading");

  useEffect(() => {
    supabase
      .from("projects")
      .select("name, preview_html, preview_sandpack, is_public")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data || !data.is_public) {
          setState("notfound");
          return;
        }
        const parsed = data.preview_sandpack != null ? lovableBundleSchema.safeParse(data.preview_sandpack) : null;
        if (parsed?.success) {
          setState({ name: data.name, kind: "sandpack", bundle: parsed.data });
          return;
        }
        if (data.preview_html) {
          setState({ name: data.name, kind: "html", html: data.preview_html });
          return;
        }
        setState("notfound");
      });
  }, [projectId]);

  if (state === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "notfound") {
    return (
      <div
        className="min-h-screen grid place-items-center px-4"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="text-center max-w-md glass rounded-3xl p-10">
          <h1 className="text-4xl font-bold text-gradient">404</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            这个项目不存在，或者作者还没有把它设为公开。
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-full btn-brand px-5 py-2 text-sm font-semibold"
          >
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
      {state.kind === "sandpack" ? (
        <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-3 overflow-hidden bg-background/40">
          <LovableSandpack bundle={state.bundle} readOnly />
        </div>
      ) : (
        <iframe
          srcDoc={state.html}
          title={state.name}
          sandbox="allow-scripts"
          className="flex-1 border-0 bg-white min-h-0"
        />
      )}
    </div>
  );
}
