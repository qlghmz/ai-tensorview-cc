import { dict, type Lang } from "@/lib/i18n-dict";

export function pickLang(loaderData: unknown): Lang {
  const l = (loaderData as { lang?: Lang } | undefined)?.lang;
  return l === "en" ? "en" : l === "zh" ? "zh" : "en";
}

export function t(lang: Lang, key: string): string {
  const d = dict[lang] as Record<string, string>;
  const fb = dict.en as Record<string, string>;
  return d[key] ?? fb[key] ?? "";
}

/**
 * Build canonical + hreflang alternates for a path.
 * canonical is per-locale path (we keep same URL for both langs since
 * language is chosen via cookie/IP — emit hreflang so Google sees both).
 */
export function localizedLinks(path: string) {
  const url = `https://ai.tensorview.cc${path}`;
  return [
    { rel: "canonical", href: url },
    { rel: "alternate", hrefLang: "zh-CN", href: url },
    { rel: "alternate", hrefLang: "en", href: url },
    { rel: "alternate", hrefLang: "x-default", href: url },
  ];
}

/**
 * Build common meta from SEO dict keys + path.
 * titleKey/descKey reference dict[lang][key].
 */
export function localizedMeta(
  lang: Lang,
  titleKey: string,
  descKey: string,
  path: string,
) {
  const title = t(lang, titleKey);
  const desc = t(lang, descKey);
  return [
    { title },
    { name: "description", content: desc },
    { property: "og:title", content: title },
    { property: "og:description", content: desc },
    { property: "og:url", content: `https://ai.tensorview.cc${path}` },
  ];
}
