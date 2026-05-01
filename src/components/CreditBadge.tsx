import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Balance {
  plan: string;
  daily: number;
  monthly: number;
  bonus: number;
  total: number;
}

export function CreditBadge() {
  const [bal, setBal] = useState<Balance | null>(null);

  const refresh = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    try {
      const res = await fetch("/_serverFn/src_server_credits_functions_ts--getMyCredits_createServerFn_handler", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      // 兼容：直接调用 server function 包装
      if (!res.ok) return;
      const json = (await res.json()) as { result?: Balance } | Balance;
      const data = "result" in (json as object) ? (json as { result: Balance }).result : (json as Balance);
      setBal(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!bal) return null;

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
