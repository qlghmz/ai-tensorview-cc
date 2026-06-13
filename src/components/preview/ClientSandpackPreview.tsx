import { useEffect, useState, type ComponentType } from "react";
import type { UiBundle } from "@/lib/ui-bundle";

type Props = {
  bundle: UiBundle;
  readOnly?: boolean;
  view?: "split" | "preview" | "code";
  onSaveFiles?: (files: Record<string, string>) => Promise<void> | void;
};

export function ClientSandpackPreview(props: Props) {
  const [Inner, setInner] = useState<ComponentType<Props> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("./SandpackPreview").then((m) => {
      if (!cancelled) setInner(() => m.SandpackPreviewPanel);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Inner) {
    return (
      <div className="flex flex-1 min-h-[200px] items-center justify-center text-muted-foreground text-sm">
        加载 Sandpack 预览…
      </div>
    );
  }

  return <Inner {...props} />;
}
