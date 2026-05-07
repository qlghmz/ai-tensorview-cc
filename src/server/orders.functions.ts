import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRICE_CNY: Record<string, number> = { pro: 69, team: 299 };

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ plan: z.enum(["pro", "team"]) }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const amount = PRICE_CNY[data.plan];
    const { data: row, error } = await supabase
      .from("payment_orders")
      .insert({ user_id: userId, plan: data.plan, amount_cny: amount })
      .select("id, order_no, plan, amount_cny, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("payment_orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { items: data ?? [] };
  });
