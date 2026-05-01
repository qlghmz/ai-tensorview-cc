import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

    // 每日补给：超 24 小时则补到 5
    let daily = row.daily_credits;
    const last = new Date(row.daily_reset_at).getTime();
    if (Date.now() - last > 24 * 60 * 60 * 1000) {
      daily = 5;
      await supabaseAdmin
        .from("user_credits")
        .update({ daily_credits: 5, daily_reset_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    return {
      plan: row.plan,
      daily,
      monthly: row.monthly_credits,
      bonus: row.bonus_credits,
      total: daily + row.monthly_credits + row.bonus_credits,
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
