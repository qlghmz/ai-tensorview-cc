import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DAILY_CREDITS = 5;
const MONTHLY_CREDITS: Record<string, number> = { pro: 100, team: 500 };

export const getMyCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: row } = await supabaseAdmin
      .from("user_credits")
      .select("plan, daily_credits, monthly_credits, bonus_credits, daily_reset_at, monthly_reset_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!row) {
      // 兜底：补建
      await supabaseAdmin
        .from("user_credits")
        .insert({ user_id: userId, plan: "free", daily_credits: 5, bonus_credits: 30 });
      return {
        plan: "free",
        daily: 5,
        monthly: 0,
        bonus: 30,
        total: 35,
      };
    }

    // 每日补给：超 24 小时则补到 5；会员 credits 每月补到套餐额度。
    let daily = row.daily_credits;
    let monthly = row.monthly_credits;
    const last = new Date(row.daily_reset_at).getTime();
    if (Date.now() - last > 24 * 60 * 60 * 1000) {
      daily = DAILY_CREDITS;
      await supabaseAdmin
        .from("user_credits")
        .update({ daily_credits: DAILY_CREDITS, daily_reset_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    const monthlyAllowance = MONTHLY_CREDITS[row.plan] ?? 0;
    const monthlyLast = new Date(row.monthly_reset_at).getTime();
    if (monthlyAllowance > 0 && Date.now() - monthlyLast > 30 * 24 * 60 * 60 * 1000) {
      monthly = monthlyAllowance;
      await supabaseAdmin
        .from("user_credits")
        .update({ monthly_credits: monthlyAllowance, monthly_reset_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    return {
      plan: row.plan,
      daily,
      monthly,
      bonus: row.bonus_credits,
      total: daily + monthly + row.bonus_credits,
    };
  });

export const getMyCreditTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("credit_transactions")
      .select("id, amount, reason, balance_after, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { items: data ?? [] };
  });
