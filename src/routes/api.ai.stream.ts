import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAIConfig } from "@/lib/ai-config";
import { getAuthedSupabaseFromRequest } from "@/integrations/supabase/request-auth";
import { beginWebsiteGeneration, generateSegmentedUiBundle, persistGenerationResult } from "@/lib/ai-generate-shared";
import { consumeCredits } from "@/lib/credits-server";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
});

export const Route = createFileRoute("/api/ai/stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getAuthedSupabaseFromRequest(request);
        if (auth instanceof Response) return auth;

        const { supabase, userId } = auth;

        let jsonBody: unknown;
        try {
          jsonBody = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = bodySchema.safeParse(jsonBody);
        if (!parsed.success) return Response.json({ error: "参数无效" }, { status: 400 });

        const cfg = getAIConfig();
        if (!cfg) return Response.json({ error: "AI 未配置：请设置后端 AI 环境变量" }, { status: 503 });

        await supabase.rpc("refill_user_credits", { _user_id: userId });
        const { data: balance } = await supabase.rpc("get_credit_balance", { _user_id: userId });
        if ((balance ?? 0) < 1) {
          return Response.json({ error: "积分不足，请充值或等待每日补给", balance: balance ?? 0 }, { status: 402 });
        }

        const begun = await beginWebsiteGeneration(supabase, userId, parsed.data.projectId, parsed.data.prompt);
        if (!begun.ok) return begun.response;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            let heartbeat: ReturnType<typeof setInterval> | null = null;
            const send = (payload: unknown) => controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
            try {
              send({ type: "ready" });
              send({ type: "status", message: "正在分段生成页面结构…" });
              heartbeat = setInterval(() => send({ type: "status", message: "AI 仍在生成，请稍候…" }), 15_000);
              const generated = await generateSegmentedUiBundle(cfg, parsed.data.prompt, begun.messages);

              let reply = generated.reply;
              let finishReason = generated.finishReason;
              if (!generated.bundle && finishReason !== "needs_backend_plan") finishReason = "force_fallback";

              const saved = await persistGenerationResult(
                supabase,
                userId,
                begun.projectId,
                reply,
                parsed.data.prompt,
                finishReason,
              );

              const { data: isAdminData } = await supabase.rpc("has_role", {
                _user_id: userId,
                _role: "admin",
              });
              const isAdmin = isAdminData === true;
              if (!isAdmin && saved.sandpack) {
                const charge = await consumeCredits(supabase, userId, 1, "ai_generate", { projectId: parsed.data.projectId });
                if (!charge.success) {
                  throw new Error(charge.error === "insufficient_credits" ? "积分不足，请充值或等待每日补给" : `扣费失败: ${charge.error}`);
                }
              }

              send({ type: "preview", sandpack: saved.sandpack });
              send({ type: "final", reply: saved.reply, sandpack: saved.sandpack, finishReason });
              if (heartbeat) clearInterval(heartbeat);
              controller.close();
            } catch (e) {
              console.error("[api/ai/stream segmented]", e);
              send({ type: "error", message: e instanceof Error ? e.message : "生成失败" });
              if (heartbeat) clearInterval(heartbeat);
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
