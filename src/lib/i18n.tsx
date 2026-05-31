import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dict, type Lang, type DictKey } from "./i18n-dict";
import { detectLangClient } from "./lang";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "tv.lang";

/**
 * `initialLang` should come from the SSR loader so the first paint matches
 * the IP-detected language and there's no client-side flicker.
 */
export function LanguageProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? "zh");

  useEffect(() => {
    // After hydration, prefer a user-pinned choice from localStorage.
    let pinned: Lang | null = null;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "zh" || stored === "en") pinned = stored as Lang;
    } catch {
      /* ignore */
    }
    const next = pinned ?? initialLang ?? detectLangClient();
    setLangState(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    }
  }, [initialLang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
      // Persist as a cookie too so SSR honors the user's choice on next visit.
      document.cookie = `tv.lang=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
    }
  }, []);

  const t = useCallback<Ctx["t"]>(
    (key, vars) => {
      const table = dict[lang] as Record<string, string>;
      let s = table[key] ?? (dict.zh as Record<string, string>)[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      lang: "zh",
      setLang: () => {},
      t: (k) => (dict.zh as Record<string, string>)[k] ?? k,
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
