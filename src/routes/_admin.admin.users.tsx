import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listAdminUsers,
  adminAdjustCredits,
  adminSetPlan,
  adminSetRole,
} from "@/server/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/users")({
  component: AdminUsers,
});

type UserRow = Awaited<ReturnType<typeof listAdminUsers>>["items"][number];

function AdminUsers() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listAdminUsers();
      setItems(r.items);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const filtered = items.filter(
    (u) => !q || u.email.toLowerCase().includes(q.toLowerCase()) || u.displayName.includes(q),
  );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Input placeholder="搜索邮箱或昵称" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={load} disabled={loading}>
          刷新
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="p-3 text-left">邮箱</th>
              <th className="p-3 text-left">昵称</th>
              <th className="p-3 text-left">套餐</th>
              <th className="p-3 text-left">积分</th>
              <th className="p-3 text-left">角色</th>
              <th className="p-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <UserRow key={u.id} u={u} onChanged={load} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({ u, onChanged }: { u: UserRow; onChanged: () => void }) {
  const [adjusting, setAdjusting] = useState(false);
  const isAdmin = u.roles.includes("admin");

  const adjust = async (sign: 1 | -1) => {
    const raw = window.prompt(`输入${sign > 0 ? "增加" : "减少"}的积分数量（正整数）`);
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return toast.error("无效数量");
    const reason = window.prompt("原因（备注）", "admin_adjust") ?? "admin_adjust";
    setAdjusting(true);
    try {
      await adminAdjustCredits({ data: { targetUserId: u.id, amount: sign * n, reason } });
      toast.success("已调整");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdjusting(false);
    }
  };

  const setPlan = async (plan: "free" | "pro" | "team") => {
    if (!confirm(`将 ${u.email} 改为 ${plan}？`)) return;
    try {
      await adminSetPlan({ data: { targetUserId: u.id, plan } });
      toast.success("已升级");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleAdmin = async () => {
    try {
      await adminSetRole({ data: { targetUserId: u.id, role: "admin", grant: !isAdmin } });
      toast.success(isAdmin ? "已撤销管理员" : "已授予管理员");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <tr className="border-t border-border">
      <td className="p-3">{u.email || "(未知)"}</td>
      <td className="p-3">{u.displayName || "—"}</td>
      <td className="p-3">
        <select
          className="rounded border border-border bg-background px-2 py-1"
          value={u.plan}
          onChange={(e) => setPlan(e.target.value as "free" | "pro" | "team")}
        >
          <option value="free">free</option>
          <option value="pro">pro</option>
          <option value="team">team</option>
        </select>
      </td>
      <td className="p-3 tabular-nums">
        {u.total} <span className="text-xs text-muted-foreground">({u.daily}+{u.monthly}+{u.bonus})</span>
      </td>
      <td className="p-3">
        {u.roles.length ? u.roles.join(", ") : <span className="text-muted-foreground">user</span>}
      </td>
      <td className="p-3 space-x-2 whitespace-nowrap">
        <Button size="sm" variant="outline" disabled={adjusting} onClick={() => adjust(1)}>
          +积分
        </Button>
        <Button size="sm" variant="outline" disabled={adjusting} onClick={() => adjust(-1)}>
          -积分
        </Button>
        <Button size="sm" variant={isAdmin ? "destructive" : "outline"} onClick={toggleAdmin}>
          {isAdmin ? "撤销管理员" : "设为管理员"}
        </Button>
      </td>
    </tr>
  );
}
