import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovableBundleSchema } from "@/lib/lovable-bundle";
import { PublicProjectView, type PublicViewState } from "@/components/PublicProjectView";

export const Route = createFileRoute("/p/$projectId")({
  ssr: false,
  component: PublicPreviewPage,
});

function PublicPreviewPage() {
  const { projectId } = Route.useParams();
  const [state, setState] = useState<PublicViewState>({ kind: "loading" });

  useEffect(() => {
    supabase
      .from("projects")
      .select("name, preview_html, preview_sandpack, published_html, is_public")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data || !data.is_public) {
          setState({ kind: "notfound" });
          return;
        }
        if (data.published_html) {
          setState({ kind: "snapshot", name: data.name, html: data.published_html });
          return;
        }
        const parsed = data.preview_sandpack != null ? lovableBundleSchema.safeParse(data.preview_sandpack) : null;
        if (parsed?.success) {
          setState({ kind: "sandpack", name: data.name, bundle: parsed.data });
          return;
        }
        if (data.preview_html) {
          setState({ kind: "html", name: data.name, html: data.preview_html });
          return;
        }
        setState({ kind: "notfound" });
      });
  }, [projectId]);

  return <PublicProjectView state={state} />;
}
