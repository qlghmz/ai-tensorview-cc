import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT } from "@/lib/i18n";

const KEY = "tv.mobile-warn.dismissed";
const TTL_MS = 24 * 60 * 60 * 1000;

export function MobileWarningBanner() {
  const isMobile = useIsMobile();
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setVisible(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem(KEY);
      const ts = raw ? Number(raw) : 0;
      if (!ts || Date.now() - ts > TTL_MS) setVisible(true);
      else setVisible(false);
    } catch {
      setVisible(true);
    }
  }, [isMobile]);

  if (!visible) return null;

  return (
    <div className="md:hidden sticky top-0 z-[60] bg-amber-500/15 text-amber-100 border-b border-amber-500/30 backdrop-blur">
      <div className="mx-auto flex items-start gap-2 px-4 py-2 text-xs leading-snug">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-300" />
        <span className="flex-1">{t("mobile.banner")}</span>
        <button
          type="button"
          aria-label={t("mobile.dismiss")}
          onClick={() => {
            try {
              window.localStorage.setItem(KEY, String(Date.now()));
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
          className="p-1 -m-1 rounded hover:bg-amber-500/20 transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Inline (non-dismissable) hint for project generation screen. */
export function MobileGenerationHint() {
  const isMobile = useIsMobile();
  const t = useT();
  if (!isMobile) return null;
  return (
    <div className="md:hidden mt-2 text-xs text-amber-300/90 flex items-start gap-1.5">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{t("mobile.banner.short")}</span>
    </div>
  );
}
