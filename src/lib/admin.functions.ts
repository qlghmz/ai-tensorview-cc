import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertAdmin(userId: string) {
  const supabaseAdmin = await getAdmin();
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || data !== true) {
    throw new Error("forbidden");
  }
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);

    const since24h = new Date(Date.now() - 86400000).toISOString();

    const [usersRes, projectsRes, gen24Res, txRes, ordersRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("projects").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("credit_transactions")
        .select("id", { count: "exact", head: true })
        .eq("reason", "ai_generate")
        .gte("created_at", since24h),
      supabaseAdmin.from("credit_transactions").select("amount").lt("amount", 0),
      supabaseAdmin
        .from("payment_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    const totalSpent = (txRes.data ?? []).reduce(
      (a: number, r: { amount: number | null }) => a + Math.abs(r.amount ?? 0),
      0,
    );

    return {
      totalUsers: usersRes.count ?? 0,
      totalProjects: projectsRes.count ?? 0,
      generations24h: gen24Res.count ?? 0,
      totalSpent,
      pendingOrders: ordersRes.count ?? 0,
    };
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);

    const [profilesRes, creditsRes, rolesRes, authRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, avatar_url, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("user_credits").select("*"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);

    const creditsMap = new Map(
      (creditsRes.data ?? []).map((r) => [r.user_id as string, r]),
    );
    const rolesMap = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      const arr = rolesMap.get(r.user_id as string) ?? [];
      arr.push(r.role as string);
      rolesMap.set(r.user_id as string, arr);
    }
    const emailMap = new Map(
      (authRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""]),
    );

    const items = (profilesRes.data ?? []).map((p) => {
      const c = creditsMap.get(p.id as string);
      return {
        id: p.id as string,
        email: emailMap.get(p.id as string) ?? "",
        displayName: (p.display_name as string | null) ?? "",
        createdAt: p.created_at as string,
        plan: (c?.plan as string) ?? "free",
        daily: (c?.daily_credits as number) ?? 0,
        monthly: (c?.monthly_credits as number) ?? 0,
        bonus: (c?.bonus_credits as number) ?? 0,
        total:
          ((c?.daily_credits as number) ?? 0) +
          ((c?.monthly_credits as number) ?? 0) +
          ((c?.bonus_credits as number) ?? 0),
        roles: rolesMap.get(p.id as string) ?? [],
      };
    });

    return { items };
  });

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
      amount: z.number().int().refine((n) => n !== 0, "amount required"),
      reason: z.string().min(1).max(120),
    }),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("admin_adjust_credits", {
      _target: data.targetUserId,
      _amount: data.amount,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const adminSetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
      plan: z.enum(["free", "pro", "team"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("admin_set_plan", {
      _target: data.targetUserId,
      _plan: data.plan,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
      role: z.enum(["admin", "moderator", "user"]),
      grant: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.targetUserId, role: data.role })
        .select()
        .maybeSingle();
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.targetUserId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("payment_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    const userIds = Array.from(new Set((data ?? []).map((o) => o.user_id as string)));
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const emailMap = new Map(
      (authData?.users ?? []).filter((u) => userIds.includes(u.id)).map((u) => [u.id, u.email ?? ""]),
    );

    return {
      items: (data ?? []).map((o) => ({
        ...o,
        email: emailMap.get(o.user_id as string) ?? "",
      })),
    };
  });

export const adminActivateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("admin_activate_order", {
      _order_id: data.orderId,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const listAdminProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("projects")
      .select("id, name, user_id, is_public, public_slug, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    return { items: data ?? [] };
  });

export const adminUnpublishProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("projects")
      .update({ is_public: false })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const listAdminTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("credit_transactions")
      .select("id, user_id, amount, reason, balance_after, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return { items: data ?? [] };
  });
