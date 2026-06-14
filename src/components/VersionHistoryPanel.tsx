import { useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uiBundleSchema, sanitizeUiBundle, type UiBundle } from "@/lib/ui-bundle";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

type VersionRow = {
  id: string;
  label: string | null;
  prompt_summary: string | null;
  created_at: string;
  preview_sandpack: Json;
};

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onRestored: (bundle: UiBundle) => void;
}

export function VersionHistoryPanel({ projectId, open, onClose, onRestored }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<VersionRow[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("project_versions")
      .select("id, label, prompt_summary, created_at, preview_sandpack")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setRows((data as VersionRow[]) ?? []);
        setLoading(false);
      });
  }, [open, projectId]);

  if (!open) return null;

  const restore = async (row: VersionRow) => {
    const parsed = uiBundleSchema.safeParse(row.preview_sandpack);
    if (!parsed.success) {
      toast.error("该版本数据无效");
      return;
    }
    setRestoring(row.id);
    const bundle = sanitizeUiBundle(parsed.data);
    const { error } = await supabase
      .from("projects")
      .update({
        preview_sandpack: bundle as unknown as Json,
        preview_html: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    setRestoring(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    onRestored(bundle);
    toast.success("已恢复到该版本");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
          <History className="h-5 w-5 text-brand" />
          <div className="font-semibold flex-1">版本历史</div>
          <button type="button" onClick={onClose} className="text-muted-foreground text-sm hover:text-foreground">
            关闭
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-2 flex-1">
          {loading ? (
            <div className="grid place-items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">暂无历史版本（每次成功生成会自动保存）</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="glass rounded-xl p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{row.label ?? row.created_at}</div>
                  {row.prompt_summary && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{row.prompt_summary}</div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={restoring === row.id}
                  onClick={() => restore(row)}
                  className="shrink-0 rounded-lg btn-brand px-2.5 py-1.5 text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  {restoring === row.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  恢复
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
