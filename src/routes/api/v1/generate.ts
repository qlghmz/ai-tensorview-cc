import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAIConfig } from "@/lib/ai-config";
import { getAuthedSupabaseFromRequest } from "@/integrations/supabase/request-auth";
import { getAdmin } from "@/integrations/supabase/admin.server";
import { resolveUserIdFromApiKey } from "@/lib/api-keys-server";
import {
  beginWebsiteGeneration,
  generateSegmentedUiBundle,
  persistGenerationResult,
} from "@/lib/ai-generate-shared";
import { consumeCredits } from "@/lib/credits-server";
import { applyStyleToPrompt } from "@/lib/ui-styles";
import type { Database } from "@/integrations/supabase/types";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
  styleId: z.string().optional(),
  referenceImage: z.string().max(6_000_000).optional(),
  figmaUrl: z.string().url().max(500).optional(),
});

type AuthCtx = { supabase: SupabaseClient<Database>; userId: string };

async function resolveAuth(request: Request): Promise<AuthCtx | Response> {
  const apiKey = request.headers.get("X-API-Key")?.trim();
  if (apiKey) {
    const admin = await getAdmin();
    const userId = await resolveUserIdFromApiKey(admin, apiKey);
    if (!userId) return Response.json({ error: "Invalid API key" }, { status: 401 });
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return Response.json({ error: "Server misconfigured" }, { status: 500 });
    const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });
    return { supabase, userId };
  }
  const auth = await getAuthedSupabaseFromRequest(request);
  if (auth instanceof Response) return auth;
  return auth;
}

export const Route = createFileRoute("/api/v1/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await resolveAuth(request);
        if (auth instanceof Response) return auth;
        const { supabase, userId } = auth;

        let jsonBody: unknown;
        try {
          jsonBody = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const parsed = bodySchema.safeParse(jsonBody);
        if (!parsed.success) return Response.json({ error: "Invalid parameters" }, { status: 400 });

        const cfg = getAIConfig();
        if (!cfg) return Response.json({ error: "AI not configured" }, { status: 503 });

        await supabase.rpc("refill_user_credits", { _user_id: userId });
        const { data: balance } = await supabase.rpc("get_credit_balance", { _user_id: userId });
        if ((balance ?? 0) < 1) {
          return Response.json({ error: "Insufficient credits", balance: balance ?? 0 }, { status: 402 });
        }

        const prompt = applyStyleToPrompt(parsed.data.prompt, parsed.data.styleId);
        const begun = await beginWebsiteGeneration(supabase, userId, parsed.data.projectId, prompt, {
          reference: {
            imageDataUrl: parsed.data.referenceImage,
            figmaUrl: parsed.data.figmaUrl,
          },
        });
        if (!begun.ok) return begun.response;

        const generated = await generateSegmentedUiBundle(cfg, begun.effectivePrompt, begun.messages);
        const saved = await persistGenerationResult(
          supabase,
          userId,
          begun.projectId,
          generated.reply,
          prompt,
          generated.finishReason,
        );

        const { data: isAdminData } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });
        if (isAdminData !== true && saved.sandpack) {
          const charge = await consumeCredits(supabase, userId, 1, "ai_generate", {
            projectId: parsed.data.projectId,
          });
          if (!charge.success) {
            return Response.json({ error: charge.error ?? "Charge failed" }, { status: 402 });
          }
        }

        return Response.json({
          ok: true,
          reply: saved.reply,
          sandpack: saved.sandpack,
          finishReason: generated.finishReason,
        });
      },
    },
  },
});
