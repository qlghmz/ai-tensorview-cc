import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAdminOverview } from "@/server/admin.functions";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_admin/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminOverview>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getAdminOverview()
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) return <div className="text-destructive">加载失败: {err}</div>;
  if (!data) return <div className="text-muted-foreground">加载中…</div>;

  const stats = [
    { label: "总用户数", value: data.totalUsers },
    { label: "总项目数", value: data.totalProjects },
    { label: "近 24h 生成", value: data.generations24h },
    { label: "累计消耗积分", value: data.totalSpent },
    { label: "待处理订单", value: data.pendingOrders },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {stats.map((s) => (
        <Card key={s.label} className="p-5">
          <div className="text-xs text-muted-foreground">{s.label}</div>
          <div className="mt-2 text-3xl font-bold tabular-nums">{s.value}</div>
        </Card>
      ))}
    </div>
  );
}
