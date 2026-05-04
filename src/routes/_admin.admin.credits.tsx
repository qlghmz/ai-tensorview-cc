import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listAdminTransactions } from "@/server/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/credits")({
  component: AdminCredits,
});

type Row = Awaited<ReturnType<typeof listAdminTransactions>>["items"][number];

function AdminCredits() {
  const [items, setItems] = useState<Row[]>([]);
  useEffect(() => {
    listAdminTransactions()
      .then((r) => setItems(r.items))
      .catch((e: Error) => toast.error(e.message));
  }, []);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="p-3 text-left">用户</th>
            <th className="p-3 text-left">变动</th>
            <th className="p-3 text-left">原因</th>
            <th className="p-3 text-left">余额</th>
            <th className="p-3 text-left">时间</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id as string} className="border-t border-border">
              <td className="p-3 font-mono text-xs">{(t.user_id as string).slice(0, 8)}…</td>
              <td className={`p-3 tabular-nums ${(t.amount as number) > 0 ? "text-green-400" : "text-amber-300"}`}>
                {(t.amount as number) > 0 ? "+" : ""}
                {t.amount as number}
              </td>
              <td className="p-3">{t.reason as string}</td>
              <td className="p-3 tabular-nums">{t.balance_after as number}</td>
              <td className="p-3 text-xs text-muted-foreground">
                {new Date(t.created_at as string).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
