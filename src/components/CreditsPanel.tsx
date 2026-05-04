import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Coins, Gift, Calendar, Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getMyCredits, getMyCreditTransactions } from "@/server/credits.functions";

interface Balance {
  plan: string;
  daily: number;
  monthly: number;
  bonus: number;
  total: number;
}

interface Tx {
  id: string;
  amount: number;
  reason: string;
  balance_after: number;
  created_at: string;
}

const REASON_LABEL: Record<string, string> = {
  signup_bonus: "注册赠送",
  ai_generate: "AI 生成",
  daily_refill: "每日补给",
  monthly_refill: "会员补给",
  purchase: "充值",
};

export function CreditsPanel() {
  const [bal, setBal] = useState<Balance | null>(null);
  const [tx, setTx] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, t] = await Promise.all([
          getMyCredits() as Promise<Balance>,
          getMyCreditTransactions() as Promise<{ items: Tx[] }>,
        ]);
        if (!cancelled) {
          setBal(b);
          setTx(t.items);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !bal) {
    return (
      <section className="glass rounded-3xl p-6 mt-5">
        <div className="text-sm text-muted-foreground">加载积分中…</div>
      </section>
    );
  }

  return (
    <section className="glass rounded-3xl p-6 mt-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-amber-400" />
          <span className="font-semibold">积分余额</span>
          <span className="text-xs uppercase rounded-full px-2 py-0.5 border border-border text-muted-foreground">
            {bal.plan}
          </span>
        </div>
        <Link to="/pricing" className="text-xs text-brand hover:underline">升级套餐 →</Link>
      </div>

      <div className="text-4xl font-bold tabular-nums mb-4">{bal.total}</div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card icon={<Calendar className="h-4 w-4" />} label="每日" value={bal.daily} hint="每天补到 5" />
        <Card icon={<Crown className="h-4 w-4" />} label="会员" value={bal.monthly} hint="Pro 100/月" />
        <Card icon={<Gift className="h-4 w-4" />} label="赠送" value={bal.bonus} hint="永久有效" />
      </div>

      <div className="text-xs font-medium text-muted-foreground mb-2">最近 50 条流水</div>
      <div className="rounded-xl border border-border divide-y divide-border max-h-72 overflow-y-auto">
        {tx.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">暂无流水</div>
        ) : (
          tx.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div>{REASON_LABEL[t.reason] ?? t.reason}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleString("zh-CN")}
                </div>
              </div>
              <div className={`tabular-nums font-medium ${t.amount > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {t.amount > 0 ? `+${t.amount}` : t.amount}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Card({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}
