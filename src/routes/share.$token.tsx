import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getSharedProject } from "@/lib/share.functions";
import { uiBundleSchema, sanitizeUiBundle, type UiBundle } from "@/lib/ui-bundle";
import { ClientSandpackPreview } from "@/components/preview/ClientSandpackPreview";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/share/$token")({
  ssr: false,
  component: ShareViewPage,
});

function ShareViewPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"view" | "edit">("view");
  const [sandpack, setSandpack] = useState<Json | null>(null);

  useEffect(() => {
    getSharedProject({ data: { token } })
      .then((r) => {
        setName(r.project.name);
        setRole(r.role);
        setSandpack(r.project.preview_sandpack);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [token]);

  const uiBundle = useMemo((): UiBundle | null => {
    if (!sandpack) return null;
    const parsed = uiBundleSchema.safeParse(sandpack);
    return parsed.success ? sanitizeUiBundle(parsed.data) : null;
  }, [sandpack]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Link to="/" className="text-brand hover:underline text-sm">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{name}</h1>
          <p className="text-[11px] text-muted-foreground">{role === "edit" ? "可编辑分享" : "只读分享"}</p>
        </div>
        {role === "edit" && (
          <span className="text-[10px] rounded-full bg-brand/10 text-brand px-2 py-0.5">登录后可编辑</span>
        )}
      </header>
      <main className="flex-1 min-h-0">
        {uiBundle ? (
          <ClientSandpackPreview bundle={uiBundle} />
        ) : (
          <div className="grid place-items-center h-full text-muted-foreground text-sm">暂无预览内容</div>
        )}
      </main>
    </div>
  );
}
