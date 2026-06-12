import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_admin/admin/coupons")({
  component: AdminCoupons,
});

interface CouponRow {
  id: string;
  code: string;
  tier: string;
  monthly_credits: number;
  batch: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string;
}

function AdminCoupons() {
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [count, setCount] = useState(10);
  const [monthly, setMonthly] = useState(50);
  const [batch, setBatch] = useState("appsumo-2026");
  const [busy, setBusy] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("coupon_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data as CouponRow[]) ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const generate = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_generate_coupon_codes", {
      _count: count,
      _tier: "lifetime_tier_1",
      _monthly_credits: monthly,
      _batch: batch || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const codes = (data as string[] | null) ?? [];
    setLastGenerated(codes);
    toast.success(`已生成 ${codes.length} 个兑换码`);
    void load();
  };

  const exportCSV = () => {
    if (!lastGenerated.length) return;
    const blob = new Blob([lastGenerated.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coupons-${batch || "batch"}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = {
    total: rows.length,
    used: rows.filter((r) => r.redeemed_by).length,
    unused: rows.filter((r) => !r.redeemed_by).length,
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border p-5">
        <h2 className="font-semibold mb-3">批量生成兑换码（Tier 1）</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <label className="text-xs">
            数量
            <input
              type="number"
              min={1}
              max={5000}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            每月额度
            <input
              type="number"
              min={1}
              value={monthly}
              onChange={(e) => setMonthly(Number(e.target.value))}
              className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            批次名（可选）
            <input
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-md btn-brand px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            {busy ? "生成中…" : "生成"}
          </button>
        </div>
        {lastGenerated.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground">
                本次生成 {lastGenerated.length} 个（请立即导出，关闭后无法再次显示完整列表）
              </div>
              <button
                onClick={exportCSV}
                className="text-xs rounded-md border border-border px-3 py-1 hover:bg-accent/30"
              >
                导出 CSV
              </button>
            </div>
            <pre className="max-h-48 overflow-y-auto rounded-md bg-muted/30 p-3 text-xs font-mono">
              {lastGenerated.join("\n")}
            </pre>
          </div>
        )}
      </section>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">总码数</div>
          <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">已使用</div>
          <div className="text-2xl font-bold tabular-nums text-amber-400">{stats.used}</div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">未使用</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-400">{stats.unused}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="p-3 text-left">码</th>
              <th className="p-3 text-left">Tier</th>
              <th className="p-3 text-left">额度/月</th>
              <th className="p-3 text-left">批次</th>
              <th className="p-3 text-left">状态</th>
              <th className="p-3 text-left">兑换时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs">{r.code}</td>
                <td className="p-3 text-xs">{r.tier}</td>
                <td className="p-3 tabular-nums">{r.monthly_credits}</td>
                <td className="p-3 text-xs text-muted-foreground">{r.batch ?? "—"}</td>
                <td className="p-3">
                  {r.redeemed_by ? (
                    <span className="text-amber-400">已用</span>
                  ) : (
                    <span className="text-emerald-400">可用</span>
                  )}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {r.redeemed_at ? new Date(r.redeemed_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
