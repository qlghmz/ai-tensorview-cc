import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getAIConfig } from "@/lib/ai-config";
import { beginWebsiteGeneration, generateSegmentedLovableBundle, persistGenerationResult } from "@/lib/ai-generate-shared";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
});

/** 非流式生成（可选；主流程使用 /api/ai/stream） */
export const generateWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const cfg = getAIConfig();
    if (!cfg) {
      throw new Error(
        "AI 未配置：请设置 DASHSCOPE_API_KEY（阿里云百炼），或 CUSTOM_AI_API_KEY / CUSTOM_AI_BASE_URL / CUSTOM_AI_MODEL，或 LOVABLE_API_KEY。",
      );
    }

    const begun = await beginWebsiteGeneration(supabase, userId, data.projectId, data.prompt);
    if (!begun.ok) throw new Error("项目未找到");

    let generated: Awaited<ReturnType<typeof generateSegmentedLovableBundle>>;
    try {
      generated = await generateSegmentedLovableBundle(cfg, data.prompt, begun.messages);
    } catch (err) {
      console.error("AI fetch failed", err);
      throw new Error("无法连接 AI 服务，请稍后再试");
    }

    const { sandpack } = await persistGenerationResult(
      supabase,
      userId,
      data.projectId,
      generated.reply,
      data.prompt,
      generated.bundle ? generated.finishReason : "force_fallback",
    );

    return { reply: generated.reply, sandpack };
  });

export const toggleProjectPublic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid(), isPublic: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .update({ is_public: data.isPublic })
      .eq("id", data.projectId)
      .eq("user_id", userId);
    if (error) throw new Error("更新失败");
    return { ok: true };
  });
