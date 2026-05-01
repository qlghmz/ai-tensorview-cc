import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * 调用腾讯云 EdgeOne Pages 公开部署接口（无账号、无 token）：
 *   1. GET https://mcp.edgeone.site/get_base_url -> { baseUrl }
 *   2. POST baseUrl   body: { value: <html> }    -> { url: "https://xxx.edgeone.app" }
 *
 * 这个 API 是 EdgeOne 给 AI 工具用的「一次性 HTML 托管」，链接公开可访问、国内速度好。
 * 我们用它把客户做好的成品页一键发到独立域名，跟 Lovable 平台域名完全分离。
 */

const InputSchema = z.object({
  projectId: z.string().uuid(),
  html: z.string().min(20).max(5_000_000),
});

interface EdgeOneBaseResp {
  baseUrl: string;
}
interface EdgeOneDeployResp {
  url: string;
}

async function deployHtmlToEdgeOne(html: string): Promise<string> {
  const baseRes = await fetch("https://mcp.edgeone.site/get_base_url");
  if (!baseRes.ok) throw new Error(`EdgeOne baseUrl 失败: ${baseRes.status}`);
  const { baseUrl } = (await baseRes.json()) as EdgeOneBaseResp;
  if (!baseUrl) throw new Error("EdgeOne baseUrl 返回为空");

  const installationId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  const depRes = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Installation-ID": installationId,
    },
    body: JSON.stringify({ value: html }),
  });
  if (!depRes.ok) {
    const txt = await depRes.text().catch(() => "");
    throw new Error(`EdgeOne 部署失败: ${depRes.status} ${txt.slice(0, 200)}`);
  }
  const { url } = (await depRes.json()) as EdgeOneDeployResp;
  if (!url) throw new Error("EdgeOne 未返回 URL");
  return url;
}

export const publishToEdgeOne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!project || project.user_id !== userId) throw new Error("无权操作此项目");

    const publicUrl = await deployHtmlToEdgeOne(data.html);

    const { error: uErr } = await supabase
      .from("projects")
      .update({ published_url: publicUrl, is_public: true })
      .eq("id", data.projectId);
    if (uErr) throw new Error(uErr.message);

    return { url: publicUrl };
  });
