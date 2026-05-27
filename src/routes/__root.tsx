import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { FeedbackButton } from "@/components/FeedbackButton";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">页面不存在</h2>
        <p className="mt-2 text-sm text-muted-foreground">你要找的页面已被移除或地址错了。</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-full btn-brand px-5 py-2 text-sm font-medium"
        >
          回到首页
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TensorView — 用一句话生成网页应用" },
      {
        name: "description",
        content: "TensorView 是 AI 网页生成平台，用自然语言描述即可生成可运行的网站和应用，无需写代码。",
      },
      { name: "keywords", content: "AI 建站, AI 网页生成, AI 网站生成器, lovable 替代, no-code, vibe coding, TensorView" },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "TensorView — 用一句话生成网页应用" },
      { property: "og:description", content: "TensorView 是 AI 网页生成平台，用自然语言描述即可生成可运行的网站与应用。" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "TensorView" },
      { property: "og:url", content: "https://ai.tensorview.cc" },
      { property: "og:locale", content: "zh_CN" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TensorView — 用一句话生成网页应用" },
      { name: "twitter:description", content: "用自然语言描述，立即生成可运行的网站和应用。" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "TensorView",
          url: "https://ai.tensorview.cc",
          inLanguage: "zh-CN",
          description: "AI 网页生成平台，用一句话生成可运行的网站和应用。",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://ai.tensorview.cc/?q={search_term_string}",
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
          url: "https://ai.tensorview.cc",
          logo: "https://ai.tensorview.cc/favicon.ico",
        }),
      },
      {
        // Microsoft Clarity
        children:
          '(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","wxlbx0gwbn");',
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
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
  return (
    <AuthProvider>
      <Outlet />
      <FeedbackButton />
      <Toaster />
    </AuthProvider>
  );
}
