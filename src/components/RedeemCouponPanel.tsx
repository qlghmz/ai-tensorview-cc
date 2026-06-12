import { useEffect, useState } from "react";
import { Ticket, Loader2, Sparkles, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface RedeemedRow {
  code: string;
  tier: string;
  monthly_credits: number;
  redeemed_at: string;
}

interface LifetimeState {
  plan: string;
  tier: string | null;
  allowance: number;
}

export function RedeemCouponPanel() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [redeemed, setRedeemed] = useState<RedeemedRow[]>([]);
  const [lifetime, setLifetime] = useState<LifetimeState | null>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: codes }, { data: uc }] = await Promise.all([
      supabase
        .from("coupon_codes")
        .select("code, tier, monthly_credits, redeemed_at")
        .eq("redeemed_by", user.id)
        .order("redeemed_at", { ascending: false }),
      supabase
        .from("user_credits")
        .select("plan, lifetime_tier, lifetime_monthly_allowance")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    setRedeemed((codes as RedeemedRow[] | null) ?? []);
    setLifetime({
      plan: uc?.plan ?? "free",
      tier: (uc as { lifetime_tier?: string | null } | null)?.lifetime_tier ?? null,
      allowance:
        (uc as { lifetime_monthly_allowance?: number } | null)?.lifetime_monthly_allowance ?? 0,
    });
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const submit = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_coupon_code", { _code: c });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const res = data as { success: boolean; error?: string; monthly_allowance?: number };
    if (!res?.success) {
      const map: Record<string, string> = {
        code_not_found: "兑换码无效",
        code_used: "该兑换码已被使用",
        already_redeemed_by_you: "你已经兑换过这个码",
        not_authenticated: "请先登录",
      };
      toast.error(map[res?.error ?? ""] ?? res?.error ?? "兑换失败");
      return;
    }
    toast.success(`兑换成功！每月额度已升级到 ${res.monthly_allowance} 次`);
    setCode("");
    void load();
  };

  if (!user) return null;

  return (
    <section className="glass rounded-3xl p-6 mt-5">
      <div className="flex items-center gap-2 mb-1">
        <Ticket className="h-4 w-4 text-amber-400" />
        <div className="font-semibold">兑换码 / AppSumo Code</div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        输入你在 AppSumo 购买的兑换码（格式 <code className="text-xs">SUMO-XXXX-XXXX</code>）解锁终身套餐。
        额度不够？可以再买一个码<strong className="text-foreground"> 叠加使用 (Stacking) </strong>。
      </p>

      {lifetime && lifetime.plan === "lifetime" && (
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-amber-400" />
            当前套餐：Lifetime · {lifetime.tier ?? "tier_1"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3 w-3" />
            已叠加 {redeemed.length} 个码 · 每月额度 {lifetime.allowance} 次
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="SUMO-XXXX-XXXX"
          maxLength={32}
          className="flex-1 rounded-xl bg-input border border-border px-4 py-2.5 text-sm font-mono outline-none focus:border-brand transition"
        />
        <button
          onClick={submit}
          disabled={busy || !code}
          className="rounded-xl btn-brand px-5 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          兑换
        </button>
      </div>

      {redeemed.length > 0 && (
        <div className="mt-5">
          <div className="text-xs font-medium text-muted-foreground mb-2">已兑换的码</div>
          <div className="rounded-xl border border-border divide-y divide-border">
            {redeemed.map((r) => (
              <div key={r.code} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="font-mono text-xs">{r.code}</div>
                <div className="text-xs text-muted-foreground">
                  +{r.monthly_credits}/月 · {new Date(r.redeemed_at).toLocaleDateString("zh-CN")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
