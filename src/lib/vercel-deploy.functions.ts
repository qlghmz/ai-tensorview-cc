import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function getCrypto() {
  return import("@/server/deploy-token-crypto.server");
}

const PROVIDER = "vercel" as const;

// ---------- token 管理 ----------

const saveTokenSchema = z.object({
  token: z.string().trim().min(10).max(200),
  teamId: z.string().trim().max(64).optional().nullable(),
});

export const saveVercelToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveTokenSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    const { decryptToken, encryptToken, tokenTail } = await getCrypto();
    const { userId } = context;
    // 校验 token
    const probe = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    if (!probe.ok) {
      throw new Error("Vercel Token 无效，请确认权限是否包含部署权限");
    }
    const encrypted = await encryptToken(data.token);
    const tail = tokenTail(data.token);
    const { error } = await supabaseAdmin
      .from("user_deploy_tokens" as never)
      .upsert(
        {
          user_id: userId,
          provider: PROVIDER,
          token_encrypted: encrypted,
          token_tail: tail,
          team_id: data.teamId || null,
        } as never,
        { onConflict: "user_id,provider" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, tail };
  });

export const getVercelTokenStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    const { decryptToken, encryptToken, tokenTail } = await getCrypto();
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("user_deploy_tokens" as never)
      .select("token_tail, team_id")
      .eq("user_id", userId)
      .eq("provider", PROVIDER)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { hasToken: false as const };
    const row = data as { token_tail: string; team_id: string | null };
    return { hasToken: true as const, tail: row.token_tail, teamId: row.team_id };
  });

export const deleteVercelToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    const { decryptToken, encryptToken, tokenTail } = await getCrypto();
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("user_deploy_tokens" as never)
      .delete()
      .eq("user_id", userId)
      .eq("provider", PROVIDER);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- 部署 ----------

const deploySchema = z.object({
  projectId: z.string().uuid(),
  html: z.string().min(20).max(5_000_000),
  // 项目里可选的 api/*.ts 文件（path → 源码），由前端从 LovableBundle 抽出
  apiFiles: z.record(z.string().max(200_000)).optional(),
});

interface VercelFile {
  file: string;
  data: string; // 我们用 base64 模式（encoding: 'base64'）
  encoding: "base64";
}

interface VercelDeployResp {
  id: string;
  url: string; // host, no scheme
  readyState?: string;
  alias?: string[];
  projectId?: string;
}

function b64encode(text: string): string {
  // Workers / 浏览器都有 btoa；先做 UTF-8 安全编码
  const utf8 = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < utf8.length; i++) bin += String.fromCharCode(utf8[i]);
  return btoa(bin);
}

function projectNameFor(projectId: string): string {
  // Vercel 项目名要求：小写字母数字和 -，最多 100 字
  return ("tv-" + projectId.replace(/-/g, "")).slice(0, 52).toLowerCase();
}

export const publishToVercel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deploySchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    const { decryptToken, encryptToken, tokenTail } = await getCrypto();
    const { userId } = context;

    // 1) 校验项目归属
    const { data: project, error: pErr } = await supabaseAdmin
      .from("projects")
      .select("id, user_id, vercel_project_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!project || project.user_id !== userId) throw new Error("无权操作此项目");

    // 2) 取 token
    const { data: tokRow, error: tErr } = await supabaseAdmin
      .from("user_deploy_tokens" as never)
      .select("token_encrypted, team_id")
      .eq("user_id", userId)
      .eq("provider", PROVIDER)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tokRow) throw new Error("请先填入 Vercel Token");
    const { token_encrypted, team_id } = tokRow as {
      token_encrypted: string;
      team_id: string | null;
    };
    const token = await decryptToken(token_encrypted);

    // 3) 组装文件
    const files: VercelFile[] = [
      { file: "index.html", data: b64encode(data.html), encoding: "base64" },
    ];
    if (data.apiFiles) {
      for (const [rel, src] of Object.entries(data.apiFiles)) {
        const clean = rel.replace(/^\/+/, "");
        if (!clean.startsWith("api/")) continue;
        files.push({ file: clean, data: b64encode(src), encoding: "base64" });
      }
    }

    // 4) 部署
    const teamQuery = team_id ? `?teamId=${encodeURIComponent(team_id)}` : "";
    const depRes = await fetch(`https://api.vercel.com/v13/deployments${teamQuery}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectNameFor(project.id),
        files,
        target: "production",
        projectSettings: { framework: null },
      }),
    });

    if (!depRes.ok) {
      const txt = await depRes.text().catch(() => "");
      throw new Error(`Vercel 部署失败: ${depRes.status} ${txt.slice(0, 300)}`);
    }
    const dep = (await depRes.json()) as VercelDeployResp;
    const publicUrl = `https://${dep.url}`;

    await supabaseAdmin
      .from("projects")
      .update({
        vercel_deployment_url: publicUrl,
        vercel_project_id: dep.projectId ?? null,
        is_public: true,
      })
      .eq("id", project.id);

    return { url: publicUrl, deploymentId: dep.id };
  });

