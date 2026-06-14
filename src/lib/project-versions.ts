import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { UiBundle } from "@/lib/ui-bundle";

const MAX_VERSIONS_PER_PROJECT = 30;

export async function saveProjectVersion(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  bundle: UiBundle,
  promptSummary?: string,
): Promise<void> {
  const label = new Date().toLocaleString("zh-CN", { hour12: false });
  await supabase.from("project_versions").insert({
    project_id: projectId,
    user_id: userId,
    label,
    preview_sandpack: bundle as unknown as Json,
    prompt_summary: promptSummary?.slice(0, 200) ?? null,
  });

  const { data: old } = await supabase
    .from("project_versions")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .range(MAX_VERSIONS_PER_PROJECT, 200);

  if (old?.length) {
    await supabase
      .from("project_versions")
      .delete()
      .in(
        "id",
        old.map((r) => r.id),
      );
  }
}
