// Server-only language detection from Cloudflare's `cf-ipcountry` header.
// Imported via dynamic import inside `typeof window === 'undefined'` guards
// so it never reaches the client bundle.
import { getRequestHeader, getCookie, setCookie } from "@tanstack/react-start/server";
import type { Lang } from "./i18n-dict";

/**
 * Order of precedence:
 *   1. existing `tv.lang` cookie (user pinned language — never override)
 *   2. CF-IPCountry header (CN → zh, everything else → en, including HK/TW/MO)
 *   3. Accept-Language header (zh* → zh, otherwise en)
 *   4. en fallback
 *
 * The detected default is cached in a `tv.lang.auto` cookie so future SSR
 * passes don't re-run detection unless the user has not yet pinned a choice.
 */
export function detectLangServer(): Lang {
  try {
    const pinned = getCookie("tv.lang");
    if (pinned === "zh" || pinned === "en") return pinned as Lang;
  } catch {
    /* ignore */
  }

  // Reuse cached auto-detection
  try {
    const cached = getCookie("tv.lang.auto");
    if (cached === "zh" || cached === "en") return cached as Lang;
  } catch {
    /* ignore */
  }

  let lang: Lang = "en";
  try {
    const country = (getRequestHeader("cf-ipcountry") ?? "").toUpperCase();
    if (country === "CN") {
      lang = "zh";
    } else if (!country) {
      // Header missing (local dev, non-Cloudflare) — fall back to Accept-Language
      const accept = (getRequestHeader("accept-language") ?? "").toLowerCase();
      if (accept.startsWith("zh")) lang = "zh";
    }
  } catch {
    /* ignore */
  }

  try {
    setCookie("tv.lang.auto", lang, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  } catch {
    /* ignore */
  }
  return lang;
}
