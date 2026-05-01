import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  defaultDark,
} from "@codesandbox/sandpack-react";
import { useEffect, useMemo, useState } from "react";
import { buildSandpackFiles, bundleSignature, type LovableBundle } from "@/lib/lovable-bundle";

export function LovableSandpack({
  bundle,
  readOnly,
}: {
  bundle: LovableBundle;
  readOnly?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [route, setRoute] = useState(bundle.routes[0]?.path ?? "/");

  useEffect(() => {
    const first = bundle.routes[0]?.path ?? "/";
    setRoute(first);
  }, [bundleSignature(bundle)]);

  const files = useMemo(() => buildSandpackFiles(bundle, route), [bundle, route]);

  if (!mounted) {
    return (
      <div className="flex flex-1 min-h-[200px] items-center justify-center text-muted-foreground text-sm">
        加载 Sandpack 预览…
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <div className="flex flex-wrap items-center gap-2 shrink-0 px-1">
        <span className="text-xs text-muted-foreground whitespace-nowrap">页面</span>
        <select
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 min-w-[160px] max-w-full"
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
      <div className="flex-1 min-h-[320px] rounded-xl overflow-hidden border border-border/60 [&_.sp-layout]:min-h-[300px] [&_.sp-stack]:min-h-[280px]">
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
          <SandpackLayout>
            <SandpackCodeEditor showTabs showLineNumbers readOnly={!!readOnly} />
            <SandpackPreview showNavigator={false} />
          </SandpackLayout>
        </SandpackProvider>
      </div>
    </div>
  );
}
