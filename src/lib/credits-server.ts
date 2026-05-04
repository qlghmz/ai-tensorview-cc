// 扣费：通过已认证 supabase 客户端调用 SECURITY DEFINER 函数 consume_credits。
// 不依赖 service_role key（Worker 环境下不存在）。
import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsumeResult =
  | { success: true; balance: number }
  | { success: false; error: string; balance: number };

export async function consumeCredits(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>,
): Promise<ConsumeResult> {
  if (amount <= 0) return { success: false, error: "invalid_amount", balance: 0 };

  const { data, error } = await supabase.rpc("consume_credits", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _metadata: (metadata ?? null) as never,
  });

  if (error) {
    console.error("[consumeCredits] rpc", error);
    return { success: false, error: error.message, balance: 0 };
  }

  const result = data as { success: boolean; balance: number; error?: string } | null;
  if (!result || !result.success) {
    return {
      success: false,
      error: result?.error ?? "unknown",
      balance: result?.balance ?? 0,
    };
  }
  return { success: true, balance: result.balance };
}
