import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listAdminOrders, adminActivateOrder } from "@/server/admin.functions";
import { sendTransactionalEmail } from "@/lib/email/send";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/orders")({
  component: AdminOrders,
});

type OrderRow = Awaited<ReturnType<typeof listAdminOrders>>["items"][number];

function AdminOrders() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const load = async () => {
    try {
      const r = await listAdminOrders();
      setItems(r.items);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const activate = async (id: string) => {
    if (!confirm("确认标记为已支付？将自动升级用户套餐")) return;
    try {
      await adminActivateOrder({ data: { orderId: id } });
      toast.success("已激活");
      const o = items.find((x) => (x.id as string) === id);
      const email = (o as { email?: string } | undefined)?.email;
      if (email && o) {
        sendTransactionalEmail({
          templateName: "order-activated",
          recipientEmail: email,
          idempotencyKey: `order-activated-${id}`,
          templateData: { orderNo: o.order_no, plan: o.plan },
        }).catch((e) => console.warn("order-activated email failed", e));
      }
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="p-3 text-left">订单号</th>
            <th className="p-3 text-left">用户</th>
            <th className="p-3 text-left">套餐</th>
            <th className="p-3 text-left">金额</th>
            <th className="p-3 text-left">状态</th>
            <th className="p-3 text-left">创建</th>
            <th className="p-3 text-left">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.id as string} className="border-t border-border">
              <td className="p-3 font-mono text-xs">{o.order_no as string}</td>
              <td className="p-3">{(o as { email: string }).email}</td>
              <td className="p-3">{o.plan as string}</td>
              <td className="p-3">¥{o.amount_cny as number}</td>
              <td className="p-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    o.status === "paid"
                      ? "bg-green-500/20 text-green-300"
                      : o.status === "pending"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {o.status as string}
                </span>
              </td>
              <td className="p-3 text-xs text-muted-foreground">
                {new Date(o.created_at as string).toLocaleString()}
              </td>
              <td className="p-3">
                {o.status === "pending" && (
                  <Button size="sm" onClick={() => activate(o.id as string)}>
                    标记已支付
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="p-8 text-center text-muted-foreground">
                暂无订单
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
