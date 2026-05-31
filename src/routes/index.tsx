import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ArrowRight, Wand2, Code2, Database, Rocket, Zap, Shield, Globe, Check } from "lucide-react";
// Note: Pricing & FAQ on the home page link to dedicated /pricing and /docs routes for better SEO.
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TensorView AI — AI 建站平台 | 一句话生成并部署网页应用" },
      {
        name: "description",
        content:
          "TensorView AI 是面向开发者与创作者的 AI 建站平台。用自然语言一句话生成、编辑并一键部署现代网页应用，无需写代码。Build, customize, and deploy modern web apps in seconds.",
      },
      { property: "og:title", content: "TensorView AI — AI 建站平台 | 一句话生成网页应用" },
      {
        property: "og:description",
        content: "用 AI 一句话生成可运行的网站与应用，几秒钟内构建、定制并部署。开发者与创作者的 AI 建站首选。",
      },
      { property: "og:url", content: "https://ai.tensorview.cc/" },
      { name: "twitter:title", content: "TensorView AI — AI Web Builder" },
      {
        name: "twitter:description",
        content: "Build, customize, and deploy modern web applications in seconds with TensorView AI.",
      },
    ],
    links: [{ rel: "canonical", href: "https://ai.tensorview.cc/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "TensorView AI",
          operatingSystem: "All",
          applicationCategory: "DeveloperApplication",
          url: "https://ai.tensorview.cc/",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description:
            "An AI-driven web building platform that allows users to create and deploy beautiful websites instantly using generative AI.",
        }),
      },
    ],
  }),
  component: Landing,
});

const SUGGESTIONS = [
  "做一个极简风格的待办清单 SaaS 落地页",
  "生成一个深色主题的开发者作品集",
  "做一个咖啡品牌的电商首页",
  "搭一个 AI 对话产品的官网",
];

function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useT();
  const [prompt, setPrompt] = useState("");

  const SUGGESTIONS = [
    t("landing.suggest.1"),
    t("landing.suggest.2"),
    t("landing.suggest.3"),
    t("landing.suggest.4"),
  ];

  const start = () => {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", prompt } });
    } else {
      navigate({ to: "/dashboard", search: { prompt } });
    }
  };


  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <SiteHeader />

      {/* HERO */}
      <section className="relative mx-auto max-w-[1100px] px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground">
          <span className="grid h-1.5 w-1.5 rounded-full bg-brand" />
          全新 AI 引擎已上线 · 生成速度提升 3 倍
        </div>

        <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
          <span className="inline-flex items-center gap-3">
            用一句话
            <span className="inline-flex items-center rounded-full bg-brand/15 text-brand border border-brand/30 px-2.5 py-0.5 text-xs font-semibold tracking-wider align-middle">
              BETA
            </span>
          </span>
          <br />
          <span className="text-gradient">生成你的网站</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          TensorView把你的想法变成可运行的网页应用。无需写一行代码。
        </p>

        {/* Prompt box */}
        <div className="mt-10 max-w-2xl mx-auto">
          <div className="glass rounded-3xl p-2 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 ml-3 text-brand" />
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && prompt && start()}
                placeholder="描述一个你想要的网站，比如：一个极简的笔记应用..."
                className="flex-1 bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={start}
                disabled={!prompt}
                className="rounded-2xl btn-brand px-5 py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="rounded-full glass px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
          {["✨ 即开即用", "🚀 一键发布", "🔒 安全托管", "💳 无需信用卡"].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative mx-auto max-w-[1200px] px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-bold">为创造者打造</h2>
          <p className="mt-3 text-muted-foreground">从灵感到上线，只差一句话。</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { i: Wand2, t: "AI 生成", d: "用自然语言描述，AI 立即生成完整网页。" },
            { i: Code2, t: "实时预览", d: "聊天即编辑。每次修改实时反映在预览中。" },
            { i: Database, t: "云端后端", d: "数据库、用户、存储一键启用。" },
            { i: Rocket, t: "一键部署", d: "自动打包，秒级上线，全球加速。" },
            { i: Zap, t: "极速响应", d: "毫秒级编辑反馈，流畅创作体验。" },
            { i: Shield, t: "安全可靠", d: "企业级安全，数据全程加密。" },
          ].map((f) => (
            <div key={f.t} className="glass rounded-2xl p-6 group hover:border-brand/40 transition">
              <span className="grid h-10 w-10 place-items-center rounded-xl btn-brand">
                <f.i className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase */}
      <section id="showcase" className="relative mx-auto max-w-[1200px] px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-bold">用户在创造什么</h2>
          <p className="mt-3 text-muted-foreground">100,000+ 项目已经在TensorView上诞生。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { t: "极简笔记", d: "一个支持 Markdown 的笔记应用", g: "linear-gradient(135deg, oklch(0.4 0.2 350), oklch(0.3 0.15 295))" },
            { t: "咖啡商店", d: "精品咖啡的电商落地页", g: "linear-gradient(135deg, oklch(0.4 0.18 30), oklch(0.3 0.12 50))" },
            { t: "AI 对话", d: "可定制的 AI 聊天工具", g: "linear-gradient(135deg, oklch(0.35 0.2 250), oklch(0.3 0.18 295))" },
            { t: "作品集", d: "深色风格的开发者主页", g: "linear-gradient(135deg, oklch(0.3 0.12 200), oklch(0.25 0.1 230))" },
            { t: "活动页", d: "线下活动报名落地页", g: "linear-gradient(135deg, oklch(0.4 0.2 12), oklch(0.3 0.15 350))" },
            { t: "数据看板", d: "团队 SaaS 数据仪表盘", g: "linear-gradient(135deg, oklch(0.35 0.18 160), oklch(0.3 0.15 200))" },
          ].map((c) => (
            <div key={c.t} className="glass rounded-2xl overflow-hidden group cursor-pointer">
              <div className="aspect-[16/10] relative" style={{ background: c.g }}>
                <div className="absolute inset-0 bg-grid opacity-30" />
                <div className="absolute bottom-3 left-3 glass rounded-lg px-2 py-1 text-xs">在线预览</div>
              </div>
              <div className="p-4">
                <div className="font-semibold">{c.t}</div>
                <div className="text-sm text-muted-foreground">{c.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative mx-auto max-w-[1200px] px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-bold">简单直接的价格</h2>
          <p className="mt-3 text-muted-foreground">从免费开始，按需扩展。</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3 max-w-4xl mx-auto">
          {[
            { name: "免费", price: "¥0", desc: "适合体验和小项目", cta: "开始使用", features: ["每月 5 次 AI 生成", "1 个项目", "社区支持"], highlight: false },
            { name: "专业", price: "¥99", desc: "适合个人创作者", cta: "升级专业版", features: ["每月 200 次 AI 生成", "无限项目", "自定义域名", "优先支持"], highlight: true },
            { name: "团队", price: "¥299", desc: "适合团队协作", cta: "联系销售", features: ["无限 AI 生成", "团队协作", "私有部署", "专属客服"], highlight: false },
          ].map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl p-7 ${p.highlight ? "glass border-brand/60 shadow-[var(--shadow-glow)]" : "glass"}`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full btn-brand px-3 py-1 text-xs font-semibold">最受欢迎</div>
              )}
              <div className="text-sm text-muted-foreground">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{p.price}</span>
                <span className="text-sm text-muted-foreground">/月</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-brand" />
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
      </section>

      {/* FAQ */}
      <section id="faq" className="relative mx-auto max-w-[800px] px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold">常见问题</h2>
        </div>
        <div className="space-y-3">
          {[
            { q: "我需要会编程吗？", a: "完全不需要。用中文描述你想要的网站，AI 会帮你生成全部代码。" },
            { q: "生成的网页可以发布吗？", a: "可以。每个项目都有专属预览和发布链接，支持绑定自定义域名。" },
            { q: "能修改生成的内容吗？", a: "当然。你可以在聊天里继续描述修改，AI 会增量更新页面。" },
            { q: "免费额度够用吗？", a: "免费版每月有 5 次生成额度，适合体验。深度使用建议升级专业版。" },
            { q: "数据安全吗？", a: "全部数据加密存储，启用了行级权限控制，只有你能访问自己的项目。" },
          ].map((f) => (
            <details key={f.q} className="glass rounded-2xl px-5 py-4 group">
              <summary className="cursor-pointer font-medium flex items-center justify-between">
                {f.q}
                <span className="text-brand group-open:rotate-45 transition">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-[1100px] px-6 pb-20">
        <div className="rounded-3xl glass p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
          <div className="relative">
            <Globe className="h-12 w-12 mx-auto text-brand" />
            <h2 className="mt-4 text-3xl md:text-5xl font-bold">现在就开始创造</h2>
            <p className="mt-3 text-muted-foreground">免费注册，几秒钟就能生成你的第一个网页。</p>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="mt-7 inline-flex items-center gap-2 rounded-full btn-brand px-7 py-3 text-base font-semibold"
            >
              免费开始 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
