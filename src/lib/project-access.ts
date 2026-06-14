import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ProjectAccess = "owner" | "editor" | "viewer" | "none";

export async function getProjectAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
): Promise<{ access: ProjectAccess; project: Database["public"]["Tables"]["projects"]["Row"] | null }> {
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return { access: "none", project: null };
  if (project.user_id === userId) return { access: "owner", project };

  const { data: member } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (member?.role === "editor") return { access: "editor", project };
  if (member?.role === "viewer") return { access: "viewer", project };
  return { access: "none", project: null };
}

export function canEditProject(access: ProjectAccess): boolean {
  return access === "owner" || access === "editor";
}

export function canViewProject(access: ProjectAccess): boolean {
  return access !== "none";
}
