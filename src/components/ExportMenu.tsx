import { useState } from "react";
import { Archive, ChevronDown } from "lucide-react";
import type { UiBundle } from "@/lib/ui-bundle";
import { downloadProjectZip, type ExportFormat } from "@/lib/download-zip";

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "vite", label: "Vite + React" },
  { id: "next", label: "Next.js App Router" },
  { id: "vue", label: "Vue 3 壳 + React 参考" },
];

interface Props {
  bundle: UiBundle;
  projectName: string;
  disabled?: boolean;
}

export function ExportMenu({ bundle, projectName, disabled }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full glass px-3 py-1.5 text-xs hover:border-brand/40 transition disabled:opacity-40 flex items-center gap-1.5"
        title="导出项目"
      >
        <Archive className="h-3 w-3" /> 导出
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-xl border border-border bg-card shadow-lg py-1">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50"
                onClick={() => {
                  downloadProjectZip(f.id, bundle, projectName);
                  setOpen(false);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
