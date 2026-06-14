import { useMemo, useState } from "react";
import { GitCompare, Loader2 } from "lucide-react";
import { uiBundleSchema, sanitizeUiBundle, type UiBundle } from "@/lib/ui-bundle";
import type { Json } from "@/integrations/supabase/types";
import { diffUiBundles, diffSummary, type FileDiff } from "@/lib/bundle-diff";

type VersionRow = {
  id: string;
  label: string | null;
  created_at: string;
  preview_sandpack: Json;
};

interface Props {
  open: boolean;
  onClose: () => void;
  versions: VersionRow[];
  currentBundle: UiBundle | null;
}

function parseBundle(raw: Json): UiBundle | null {
  const r = uiBundleSchema.safeParse(raw);
  return r.success ? sanitizeUiBundle(r.data) : null;
}

function DiffView({ diff }: { diff: FileDiff }) {
  if (diff.status === "unchanged") return null;
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 text-xs font-mono flex items-center gap-2">
        <span
          className={
            diff.status === "added"
              ? "text-green-500"
              : diff.status === "removed"
                ? "text-red-500"
                : "text-amber-500"
          }
        >
          {diff.status}
        </span>
        {diff.path}
      </div>
      <pre className="p-3 text-[10px] leading-relaxed overflow-x-auto max-h-48">
        {(diff.hunks ?? []).map((h, i) => (
          <div
            key={i}
            className={
              h.type === "add" ? "bg-green-500/10 text-green-700 dark:text-green-300" : h.type === "remove" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "text-muted-foreground"
            }
          >
            {h.type === "add" ? "+ " : h.type === "remove" ? "- " : "  "}
            {h.line}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function VersionDiffPanel({ open, onClose, versions, currentBundle }: Props) {
  const [aId, setAId] = useState<string>("current");
  const [bId, setBId] = useState<string>(versions[0]?.id ?? "");

  const bundleA = useMemo(() => {
    if (aId === "current") return currentBundle;
    const row = versions.find((v) => v.id === aId);
    return row ? parseBundle(row.preview_sandpack) : null;
  }, [aId, currentBundle, versions]);

  const bundleB = useMemo(() => {
    if (bId === "current") return currentBundle;
    const row = versions.find((v) => v.id === bId);
    return row ? parseBundle(row.preview_sandpack) : null;
  }, [bId, currentBundle, versions]);

  const diffs = useMemo(() => diffUiBundles(bundleA, bundleB), [bundleA, bundleB]);
  const summary = useMemo(() => diffSummary(diffs), [diffs]);
  const changed = diffs.filter((d) => d.status !== "unchanged");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-brand" />
          <div className="font-semibold flex-1">版本对比</div>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            关闭
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              <span className="text-muted-foreground">基准</span>
              <select
                value={aId}
                onChange={(e) => setAId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-input border border-border px-2 py-1.5 text-xs"
              >
                <option value="current">当前预览</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label ?? v.created_at}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">对比</span>
              <select
                value={bId}
                onChange={(e) => setBId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-input border border-border px-2 py-1.5 text-xs"
              >
                <option value="current">当前预览</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label ?? v.created_at}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!bundleA && !bundleB ? (
            <div className="py-10 grid place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                +{summary.added} 新增 · −{summary.removed} 删除 · ~{summary.modified} 修改
              </p>
              <div className="space-y-3">
                {changed.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">两个版本文件内容一致</p>
                ) : (
                  changed.map((d) => <DiffView key={d.path} diff={d} />)
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
