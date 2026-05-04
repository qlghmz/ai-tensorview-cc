import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listAdminProjects, adminUnpublishProject } from "@/server/admin.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/projects")({
  component: AdminProjects,
});

type Row = Awaited<ReturnType<typeof listAdminProjects>>["items"][number];

function AdminProjects() {
  const [items, setItems] = useState<Row[]>([]);
  const load = async () => {
    try {
      const r = await listAdminProjects();
      setItems(r.items);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="p-3 text-left">名称</th>
            <th className="p-3 text-left">公开</th>
            <th className="p-3 text-left">短链</th>
            <th className="p-3 text-left">更新</th>
            <th className="p-3 text-left">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id as string} className="border-t border-border">
              <td className="p-3">{p.name as string}</td>
              <td className="p-3">{p.is_public ? "是" : "否"}</td>
              <td className="p-3 font-mono text-xs">{(p.public_slug as string) ?? "—"}</td>
              <td className="p-3 text-xs text-muted-foreground">
                {new Date(p.updated_at as string).toLocaleString()}
              </td>
              <td className="p-3 space-x-2">
                {p.is_public && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm("确认强制下线？")) return;
                      try {
                        await adminUnpublishProject({ data: { projectId: p.id as string } });
                        toast.success("已下线");
                        load();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    强制下线
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
