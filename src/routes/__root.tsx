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
      { title: "tensorview — 用一句话生成网页应用" },
      {
        name: "description",
        content: "TensorView是 AI 网页生成平台。用自然语言描述，立即生成可运行的网站和应用。",
      },
      { property: "og:title", content: "TensorView — 用一句话生成网页应用" },
      { property: "og:description", content: "TensorView 是 AI 网页生成平台，用自然语言描述即可生成可运行的网站与应用。" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ai.tensorview.cc" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TensorView — 用一句话生成网页应用" },
      { name: "twitter:description", content: "用自然语言描述，立即生成可运行的网站和应用。" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
