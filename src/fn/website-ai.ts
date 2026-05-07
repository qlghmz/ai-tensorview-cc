import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getAIConfig, chatCompletionNonStream } from "@/lib/ai-config";
import { beginWebsiteGeneration, completeTruncatedLovableReply, persistGenerationResult } from "@/lib/ai-generate-shared";

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

    let res: Response;
    try {
      res = await chatCompletionNonStream(cfg, {
        model: cfg.model,
        messages: begun.messages,
        temperature: 0.7,
      });
    } catch (err) {
      console.error("AI fetch failed", err);
      throw new Error("无法连接 AI 服务，请稍后再试");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("AI gateway error", res.status, text);
      if (res.status === 429) throw new Error("AI 请求过于频繁，请稍后再试");
      if (res.status === 402) throw new Error("AI 额度已用完，请前往工作区添加额度");
      if (res.status === 401) throw new Error("AI Key 无效，请检查后端配置");
      throw new Error(`AI 调用失败（${res.status}）`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };
    const choice = json.choices?.[0];
    let replyContent = choice?.message?.content ?? "（无内容）";
    let finishReason = choice?.finish_reason;
    if (finishReason === "length") {
      const completed = await completeTruncatedLovableReply(cfg, begun.messages, replyContent);
      replyContent = completed.reply;
      finishReason = completed.finishReason ?? finishReason;
    }

    const { sandpack } = await persistGenerationResult(
      supabase,
      userId,
      data.projectId,
      replyContent,
      data.prompt,
      finishReason,
    );

    return { reply: replyContent, sandpack };
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
