import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { LanguageProvider, useT } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import { FeedbackButton } from "@/components/FeedbackButton";
import { MobileWarningBanner } from "@/components/MobileWarningBanner";
import { detectLangClient } from "@/lib/lang";
import { getServerLang } from "@/lib/lang.functions";
import type { Lang } from "@/lib/i18n-dict";
import { dict } from "@/lib/i18n-dict";

import appCss from "../styles.css?url";

const BASE_URL = "https://ai.tensorview.cc";

function NotFoundComponent() {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">{t("nf.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("nf.sub")}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-full btn-brand px-5 py-2 text-sm font-medium"
        >
          {t("nf.home")}
        </Link>
      </div>
    </div>
  );
}

/**
 * Detect the visitor's language on every request. On the server the server
 * fn handler runs inline and reads the Cloudflare `cf-ipcountry` header /
 * cookies. On the client we skip the RPC roundtrip and read pinned
 * cookie/localStorage/navigator directly.
 */
async function detectLang(): Promise<Lang> {
  if (typeof window === "undefined") {
    try {
      return await getServerLang();
    } catch {
      return "en";
    }
  }
  return detectLangClient();
}

export const Route = createRootRoute({
  beforeLoad: async () => ({ lang: await detectLang() }),
  loader: ({ context }) => ({ lang: context.lang }),
  head: ({ loaderData }) => {
    const lang: Lang = (loaderData as { lang?: Lang } | undefined)?.lang ?? "en";
    const isZh = lang === "zh";
    const tr = (k: keyof typeof dict.zh) =>
      (dict[lang] as Record<string, string>)[k] ?? (dict.zh as Record<string, string>)[k] ?? "";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: tr("seo.site.title") },
        { name: "description", content: tr("seo.site.desc") },
        { name: "keywords", content: tr("seo.site.keywords") },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: tr("seo.site.title") },
        { property: "og:description", content: tr("seo.site.desc") },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "TensorView" },
        { property: "og:url", content: BASE_URL },
        { property: "og:locale", content: isZh ? "zh_CN" : "en_US" },
        { property: "og:locale:alternate", content: isZh ? "en_US" : "zh_CN" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: tr("seo.site.title") },
        { name: "twitter:description", content: tr("seo.site.desc") },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        // hreflang alternates so Google indexes both language versions.
        { rel: "alternate", hrefLang: "zh-CN", href: BASE_URL + "/" },
        { rel: "alternate", hrefLang: "en", href: BASE_URL + "/" },
        { rel: "alternate", hrefLang: "x-default", href: BASE_URL + "/" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "TensorView",
            url: BASE_URL,
            inLanguage: isZh ? "zh-CN" : "en",
            description: tr("seo.site.desc"),
            potentialAction: {
              "@type": "SearchAction",
              target: BASE_URL + "/?q={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "TensorView",
            url: BASE_URL,
            logo: BASE_URL + "/favicon.ico",
          }),
        },
        {
          // Microsoft Clarity
          children:
            '(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","wxlbx0gwbn");',
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // We can't synchronously access loader data here during SSR, but the html
  // lang attribute is also written by LanguageProvider after hydration. Use
  // a neutral default that's quickly overwritten.
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const data = Route.useLoaderData();
  const initialLang = (data as { lang?: Lang } | undefined)?.lang;
  return (
    <LanguageProvider initialLang={initialLang}>
      <AuthProvider>
        <MobileWarningBanner />
        <Outlet />
        <FeedbackButton />
        <Toaster />
      </AuthProvider>
    </LanguageProvider>
  );
}
