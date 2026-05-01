// Server-only helpers (do not import from client)
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DAILY_CREDITS = 5;
const MONTHLY_CREDITS: Record<string, number> = { pro: 100, team: 500 };

export type ConsumeResult =
  | { success: true; balance: number }
  | { success: false; error: string; balance: number };

/**
 * 扣费：手动实现按 daily → monthly → bonus 顺序扣减，写一条流水。
 * 使用 service_role，绕过 RLS。
 */
export async function consumeCredits(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>,
): Promise<ConsumeResult> {
  if (amount <= 0) return { success: false, error: "invalid_amount", balance: 0 };

  const { data: row, error: readErr } = await supabaseAdmin
    .from("user_credits")
    .select("plan, daily_credits, monthly_credits, bonus_credits, daily_reset_at, monthly_reset_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (readErr || !row) {
    console.error("[consumeCredits] read", readErr);
    return { success: false, error: "no_record", balance: 0 };
  }

  // 每日补给 + 会员每月补给
  let daily = row.daily_credits;
  let monthly = row.monthly_credits;
  let dailyResetAt = row.daily_reset_at;
  let monthlyResetAt = row.monthly_reset_at;
  const last = new Date(row.daily_reset_at).getTime();
  if (Date.now() - last > 24 * 60 * 60 * 1000) {
    daily = DAILY_CREDITS;
    dailyResetAt = new Date().toISOString();
  }

  const monthlyAllowance = MONTHLY_CREDITS[row.plan] ?? 0;
  const monthlyLast = new Date(row.monthly_reset_at).getTime();
  if (monthlyAllowance > 0 && Date.now() - monthlyLast > 30 * 24 * 60 * 60 * 1000) {
    monthly = monthlyAllowance;
    monthlyResetAt = new Date().toISOString();
  }

  const total = daily + monthly + row.bonus_credits;
  if (total < amount) {
    return { success: false, error: "insufficient_credits", balance: total };
  }

  let remaining = amount;
  const newDaily = Math.max(0, daily - remaining);
  remaining -= daily - newDaily;
  const newMonthly = Math.max(0, monthly - remaining);
  remaining -= monthly - newMonthly;
  const newBonus = Math.max(0, row.bonus_credits - remaining);

  const newTotal = newDaily + newMonthly + newBonus;

  const { error: updErr } = await supabaseAdmin
    .from("user_credits")
    .update({
      daily_credits: newDaily,
      monthly_credits: newMonthly,
      bonus_credits: newBonus,
      daily_reset_at: dailyResetAt,
      monthly_reset_at: monthlyResetAt,
    })
    .eq("user_id", userId);

  if (updErr) {
    console.error("[consumeCredits] update", updErr);
    return { success: false, error: "update_failed", balance: total };
  }

  await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    amount: -amount,
    reason,
    balance_after: newTotal,
    metadata: (metadata ?? null) as never,
  });

  return { success: true, balance: newTotal };
}
