// Server-only helpers (do not import from client)
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ConsumeResult =
  | { success: true; balance: number }
  | { success: false; error: "insufficient_credits"; balance: number };

/**
 * 通过 service_role 调用数据库 SECURITY DEFINER 函数扣费。
 * 失败时返回 { success: false }；成功返回新余额。
 */
export async function consumeCredits(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>,
): Promise<ConsumeResult> {
  const { data, error } = await supabaseAdmin.rpc("consume_credits", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _metadata: (metadata ?? null) as never,
  } as never);
  if (error) {
    console.error("[consumeCredits]", error);
    return { success: false, error: "insufficient_credits", balance: 0 };
  }
  return data as ConsumeResult;
}
