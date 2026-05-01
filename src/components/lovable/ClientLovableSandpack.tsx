import { useEffect, useState, type ComponentType } from "react";
import type { LovableBundle } from "@/lib/lovable-bundle";

type Props = { bundle: LovableBundle; readOnly?: boolean };

/**
 * Sandpack 依赖浏览器全局（如 `self`），不能在 SSR / Node 里静态引入。
 * 仅在客户端 mount 后再动态加载真实 Sandpack 组件。
 */
export function ClientLovableSandpack({ bundle, readOnly }: Props) {
  const [Inner, setInner] = useState<ComponentType<Props> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("./LovableSandpack").then((m) => {
      if (!cancelled) setInner(() => m.LovableSandpack);
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

  return <Inner bundle={bundle} readOnly={readOnly} />;
}
