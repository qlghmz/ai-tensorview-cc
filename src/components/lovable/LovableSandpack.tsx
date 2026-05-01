import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
  defaultDark,
} from "@codesandbox/sandpack-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Save, Loader2, Check } from "lucide-react";
import { buildSandpackFiles, bundleSignature, type LovableBundle } from "@/lib/lovable-bundle";

type View = "split" | "preview" | "code";

interface Props {
  bundle: LovableBundle;
  readOnly?: boolean;
  view?: View;
  /** Called when the user clicks Save in code view. Receives the latest user-editable files (no /index.tsx shell). */
  onSaveFiles?: (files: Record<string, string>) => Promise<void> | void;
}

export function LovableSandpack({ bundle, readOnly, view = "split", onSaveFiles }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [route, setRoute] = useState(bundle.routes[0]?.path ?? "/");

  useEffect(() => {
    const first = bundle.routes[0]?.path ?? "/";
    setRoute(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleSignature(bundle)]);

  const files = useMemo(() => buildSandpackFiles(bundle, route), [bundle, route]);

  if (!mounted) {
    return (
      <div className="flex flex-1 min-h-[200px] items-center justify-center text-muted-foreground text-sm">
        加载 Sandpack 预览…
      </div>
    );
  }

  // Code view: split editor + live preview, editable, with save button
  const showCode = view === "code" || view === "split";
  const showPreview = view === "preview" || view === "split";
  const codeEditable = !readOnly && view !== "preview";

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {view !== "code" && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 px-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">页面</span>
          <select
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            className="text-xs rounded-lg border border-border bg-card px-2 py-1.5 min-w-[160px] max-w-full"
            aria-label="选择预览路由"
            disabled={readOnly}
          >
            {bundle.routes.map((r) => (
              <option key={r.path} value={r.path}>
                {r.label} · {r.path}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex-1 min-h-[320px] rounded-xl overflow-hidden border border-border/60 relative [&_.sp-layout]:!min-h-full [&_.sp-layout]:!h-full [&_.sp-stack]:!min-h-full [&_.sp-stack]:!h-full [&_.sp-wrapper]:!h-full [&_.sp-preview]:!h-full [&_.sp-preview-container]:!h-full [&_.sp-preview-iframe]:!h-full">
        <SandpackProvider
          key={`${bundleSignature(bundle)}|${route}`}
          template="react-ts"
          theme={defaultDark}
          files={files}
          options={{
            autorun: true,
            recompileMode: "delayed",
            recompileDelay: 400,
            externalResources: ["https://cdn.tailwindcss.com"],
          }}
          customSetup={{
            dependencies: {
              "react-router-dom": "^6.28.0",
            },
          }}
        >
          {/* In code/split modes, force a side-by-side layout for the best edit-and-see experience */}
          <SandpackLayout style={{ height: "100%" }}>
            {showCode && (
              <SandpackCodeEditor
                showTabs
                showLineNumbers
                readOnly={!codeEditable}
                style={{ height: "100%", flex: view === "code" ? 1 : undefined }}
              />
            )}
            {showPreview && (
              <SandpackPreview showNavigator={false} style={{ height: "100%", flex: view === "split" ? 1 : undefined }} />
            )}
          </SandpackLayout>

          {codeEditable && onSaveFiles && (
            <SaveButton onSaveFiles={onSaveFiles} />
          )}
        </SandpackProvider>
      </div>
    </div>
  );
}

/**
 * Floating save button. Reads the live Sandpack files, strips the auto-generated
 * `/index.tsx` shell, and persists the rest via the parent callback.
 */
function SaveButton({ onSaveFiles }: { onSaveFiles: (files: Record<string, string>) => Promise<void> | void }) {
  const { sandpack } = useSandpack();
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const lastSavedRef = useRef<string>("");

  // Build a snapshot of the current user-visible files (exclude the wrapper /index.tsx).
  const currentSnapshot = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [path, file] of Object.entries(sandpack.files)) {
      if (path === "/index.tsx") continue;
      const code = typeof file === "string" ? file : (file as { code: string }).code;
      out[path] = code;
    }
    return out;
  }, [sandpack.files]);

  const dirty = JSON.stringify(currentSnapshot) !== lastSavedRef.current;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSaveFiles(currentSnapshot);
      lastSavedRef.current = JSON.stringify(currentSnapshot);
      setSavedAt(Date.now());
    } finally {
      setBusy(false);
    }
  };

  // Initialize the saved baseline once after first render
  useEffect(() => {
    if (!lastSavedRef.current) {
      lastSavedRef.current = JSON.stringify(currentSnapshot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      onClick={save}
      disabled={busy || !dirty}
      className="absolute top-2 right-2 z-10 rounded-full btn-brand px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-glow)] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      title={dirty ? "保存修改" : "无更改"}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : savedAt && !dirty ? (
        <Check className="h-3 w-3" />
      ) : (
        <Save className="h-3 w-3" />
      )}
      {busy ? "保存中" : !dirty && savedAt ? "已保存" : "保存"}
    </button>
  );
}
