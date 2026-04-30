import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "价格 — 特挠率i额外" },
      { name: "description", content: "特挠率i额外的简单透明定价。从免费开始，按需扩展。" },
      { property: "og:title", content: "价格 — 特挠率i额外" },
    ],
  }),
  component: PricingPage,
});

const PLANS = [
  {
    name: "免费",
    price: "¥0",
    period: "永久免费",
    desc: "适合体验和小项目",
    cta: "开始使用",
    features: ["每月 5 次 AI 生成", "1 个项目", "公开预览链接", "社区支持"],
    highlight: false,
  },
  {
    name: "专业",
    price: "¥99",
    period: "/月",
    desc: "适合个人创作者",
    cta: "升级专业版",
    features: ["每月 200 次 AI 生成", "无限项目", "自定义域名", "无水印导出", "优先邮件支持"],
    highlight: true,
  },
  {
    name: "团队",
    price: "¥299",
    period: "/月",
    desc: "适合团队协作",
    cta: "联系销售",
    features: ["无限 AI 生成", "团队协作（5 席位）", "项目权限管理", "私有部署选项", "专属客服"],
    highlight: false,
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen relative" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="relative">
        <SiteHeader />
        <main className="mx-auto max-w-[1200px] px-6 py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-brand" /> 简单透明，按月订阅，随时取消
            </div>
            <h1 className="mt-5 text-4xl md:text-6xl font-bold">
              选个适合你的<span className="text-gradient">方案</span>
            </h1>
            <p className="mt-4 text-muted-foreground">从免费试用到团队协作，按需扩展，无套路。</p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3 max-w-5xl mx-auto">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-3xl p-7 ${p.highlight ? "glass border-brand/60 shadow-[var(--shadow-glow)]" : "glass"}`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full btn-brand px-3 py-1 text-xs font-semibold">
                    最受欢迎
                  </div>
                )}
                <div className="text-sm text-muted-foreground">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className={`mt-6 block text-center rounded-full py-2.5 text-sm font-semibold ${
                    p.highlight ? "btn-brand" : "border border-border hover:bg-accent/30 transition"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center text-sm text-muted-foreground">
            还有疑问？查看
            <Link to="/docs" className="text-brand hover:underline mx-1">使用文档</Link>
            或
            <a href="mailto:hello@example.com" className="text-brand hover:underline mx-1">联系我们</a>
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
