// Client-safe language detection. Safe to import anywhere.
import type { Lang } from "./i18n-dict";

const STORAGE_KEY = "tv.lang";

export function detectLangClient(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const pinned = window.localStorage.getItem(STORAGE_KEY);
    if (pinned === "zh" || pinned === "en") return pinned as Lang;
  } catch {
    /* ignore */
  }
  try {
    const m =
      typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s*)tv\.lang(?:\.auto)?=(zh|en)/) : null;
    if (m) return m[1] as Lang;
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language?.toLowerCase() ?? "" : "";
  return nav.startsWith("zh") ? "zh" : "en";
}
