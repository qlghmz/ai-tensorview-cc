import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAIConfig, chatCompletionStream } from "@/lib/ai-config";
import { getAuthedSupabaseFromRequest } from "@/integrations/supabase/request-auth";
import { beginWebsiteGeneration, persistGenerationResult } from "@/lib/ai-generate-shared";
import { extractLovableFence, tryParseLovableBundle } from "@/lib/lovable-bundle";
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
        if (!parsed.success) {
          return Response.json({ error: "参数无效" }, { status: 400 });
        }

        const cfg = getAIConfig();
        if (!cfg) {
          return Response.json(
            { error: "AI 未配置：请设置 DASHSCOPE_API_KEY 等环境变量" },
            { status: 503 },
          );
        }

        // 管理员跳过扣费
        const { data: isAdminData } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });
        const isAdmin = isAdminData === true;

        if (!isAdmin) {
          const charge = await consumeCredits(supabase, userId, 1, "ai_generate", {
            projectId: parsed.data.projectId,
          });
          if (!charge.success) {
            return Response.json(
              {
                error:
                  charge.error === "insufficient_credits"
                    ? "积分不足，请充值或等待每日补给"
                    : `扣费失败: ${charge.error}`,
                balance: charge.balance,
              },
              { status: 402 },
            );
          }
        }

        const begun = await beginWebsiteGeneration(
          supabase,
          userId,
          parsed.data.projectId,
          parsed.data.prompt,
        );
        if (!begun.ok) return begun.response;

        const upstream = await chatCompletionStream(cfg, {
          model: cfg.model,
          messages: begun.messages,
          temperature: 0.7,
        });

        if (!upstream.ok) {
          const t = await upstream.text().catch(() => "");
          return new Response(t || upstream.statusText, { status: upstream.status });
        }

        if (!upstream.body) {
          return new Response("无响应体", { status: 502 });
        }

        const encoder = new TextEncoder();
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();

        const stream = new ReadableStream({
          async start(controller) {
            let lineBuf = "";
            let fullReply = "";
            let closed = false;

            const safeEnqueue = (payload: unknown) => {
              if (closed) return false;
              try {
                controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
                return true;
              } catch {
                closed = true;
                reader.cancel().catch(() => undefined);
                return false;
              }
            };

            const safeClose = () => {
              if (closed) return;
              closed = true;
              try {
                controller.close();
              } catch {
                // client already disconnected
              }
            };

            const flushLine = (line: string) => {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) return;
              const data = trimmed.slice(5).trim();
              if (!data || data === "[DONE]") return;
              try {
                const json = JSON.parse(data) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const piece = json.choices?.[0]?.delta?.content ?? "";
                if (piece) {
                  fullReply += piece;
                  safeEnqueue({ type: "delta", content: piece });
                  const fence = extractLovableFence(fullReply);
                  if (fence) {
                    const bundle = tryParseLovableBundle(fence);
                    if (bundle) {
                      safeEnqueue({ type: "preview", sandpack: bundle });
                    }
                  }
                }
              } catch {
                // ignore malformed SSE JSON lines
              }
            };

            // 立刻发一个 ready 帧，前端就知道连接已建立
            safeEnqueue({ type: "ready" });
            const heartbeat = setInterval(() => {
              safeEnqueue({ type: "ping" });
            }, 12_000);

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                lineBuf += decoder.decode(value, { stream: true });
                let nl: number;
                while ((nl = lineBuf.indexOf("\n")) !== -1) {
                  const line = lineBuf.slice(0, nl);
                  lineBuf = lineBuf.slice(nl + 1);
                  flushLine(line);
                }
              }
              if (lineBuf.trim()) flushLine(lineBuf);

              const { reply, sandpack } = await persistGenerationResult(
                supabase,
                userId,
                begun.projectId,
                fullReply,
                parsed.data.prompt,
              );
              safeEnqueue({ type: "final", reply, sandpack });
              safeClose();
            } catch (e) {
              if (!closed) {
                console.error("[api/ai/stream]", e);
                safeEnqueue({
                  type: "error",
                  message: e instanceof Error ? e.message : "流式生成失败",
                });
              }
              safeClose();
            } finally {
              clearInterval(heartbeat);
            }
          },
          cancel() {
            reader.cancel().catch(() => undefined);
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
