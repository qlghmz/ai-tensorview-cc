import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdmin } from "@/integrations/supabase/admin.server";

function newToken(): string {
  return randomBytes(16).toString("hex");
}

export const listProjectShareLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await getAdmin();
    const { data: project } = await admin.from("projects").select("user_id").eq("id", data.projectId).single();
    if (!project || project.user_id !== context.userId) throw new Error("无权访问");
    const { data: rows } = await admin
      .from("project_share_links")
      .select("id, token, role, expires_at, created_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    return { items: rows ?? [] };
  });

export const createProjectShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), role: z.enum(["view", "edit"]).default("view") }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await getAdmin();
    const { data: project } = await admin.from("projects").select("user_id").eq("id", data.projectId).single();
    if (!project || project.user_id !== context.userId) throw new Error("无权访问");
    const token = newToken();
    const { error } = await admin.from("project_share_links").insert({
      project_id: data.projectId,
      token,
      role: data.role,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { token, url: `/share/${token}` };
  });

export const revokeProjectShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await getAdmin();
    const { data: link } = await admin.from("project_share_links").select("project_id, created_by").eq("id", data.id).single();
    if (!link) throw new Error("链接不存在");
    const { data: project } = await admin.from("projects").select("user_id").eq("id", link.project_id).single();
    if (!project || project.user_id !== context.userId) throw new Error("无权操作");
    await admin.from("project_share_links").delete().eq("id", data.id);
    return { ok: true };
  });

export const getSharedProject = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: link } = await admin
      .from("project_share_links")
      .select("project_id, role, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!link) throw new Error("分享链接无效");
    if (link.expires_at && new Date(link.expires_at) < new Date()) throw new Error("链接已过期");

    const { data: project } = await admin
      .from("projects")
      .select("id, name, description, preview_sandpack, preview_html, is_public, public_slug")
      .eq("id", link.project_id)
      .single();
    if (!project) throw new Error("项目不存在");
    return { project, role: link.role as "view" | "edit" };
  });

export const listProjectMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await getAdmin();
    const { data: project } = await admin.from("projects").select("user_id").eq("id", data.projectId).single();
    if (!project || project.user_id !== context.userId) throw new Error("无权访问");
    const { data: rows } = await admin
      .from("project_members")
      .select("user_id, role, created_at")
      .eq("project_id", data.projectId);
    return { items: rows ?? [] };
  });

export const inviteProjectMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["viewer", "editor"]).default("viewer"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await getAdmin();
    const { data: project } = await admin.from("projects").select("user_id").eq("id", data.projectId).single();
    if (!project || project.user_id !== context.userId) throw new Error("无权邀请");

    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const target = users.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!target) throw new Error("该邮箱尚未注册，请让对方先注册或使用分享链接");

    const { error } = await admin.from("project_members").upsert(
      {
        project_id: data.projectId,
        user_id: target.id,
        role: data.role,
        invited_by: context.userId,
      },
      { onConflict: "project_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, userId: target.id };
  });

export const removeProjectMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await getAdmin();
    const { data: project } = await admin.from("projects").select("user_id").eq("id", data.projectId).single();
    if (!project || project.user_id !== context.userId) throw new Error("无权操作");
    await admin.from("project_members").delete().eq("project_id", data.projectId).eq("user_id", data.userId);
    return { ok: true };
  });

export const listCommunityTemplates = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getAdmin();
  const { data } = await admin
    .from("community_templates")
    .select("*")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  return { items: data ?? [] };
});
