import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

interface Balance {
  plan: string;
  daily: number;
  monthly: number;
  bonus: number;
  total: number;
}

export function CreditBadge() {
  const { user } = useAuth();
  const [bal, setBal] = useState<Balance | null>(null);

  useEffect(() => {
    if (!user) {
      setBal(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("user_credits")
          .select("plan, daily_credits, monthly_credits, bonus_credits")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) {
          setBal({
            plan: data?.plan ?? "free",
            daily: data?.daily_credits ?? 10,
            monthly: data?.monthly_credits ?? 0,
            bonus: data?.bonus_credits ?? 0,
            total: (data?.daily_credits ?? 10) + (data?.monthly_credits ?? 0) + (data?.bonus_credits ?? 0),
          });
        }
      } catch (e) {
        console.error("[CreditBadge]", e);
      }
    };
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user]);

  if (!user || !bal) return null;

  return (
    <Link
      to="/settings"
      title={`每日 ${bal.daily} · 每月 ${bal.monthly} · 赠送 ${bal.bonus}`}
      className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-sm hover:bg-accent/50 transition"
    >
      <Coins className="h-3.5 w-3.5 text-amber-400" />
      <span className="font-medium tabular-nums">{bal.total}</span>
    </Link>
  );
}
