import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Wand2,
  Code2,
  Database,
  Rocket,
  Zap,
  Shield,
  Globe,
  Check,
  MessageSquare,
  Layers,
  MousePointerClick,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TensorView AI — AI 建站平台 | 一句话生成并部署网页应用" },
      {
        name: "description",
        content:
          "TensorView AI 是面向开发者与创作者的 AI 建站平台。用自然语言一句话生成、编辑并一键部署现代网页应用，无需写代码。",
      },
      { property: "og:title", content: "TensorView AI — AI 建站平台" },
      {
        property: "og:description",
        content: "用 AI 一句话生成可运行的网站与应用，几秒钟内构建、定制并部署。",
      },
      { property: "og:url", content: "https://ai.tensorview.cc/" },
    ],
    links: [{ rel: "canonical", href: "https://ai.tensorview.cc/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "TensorView AI",
          applicationCategory: "DeveloperApplication",
          url: "https://ai.tensorview.cc/",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: Landing,
});

function HeroBrowserMock() {
  return (
    <div className="landing-browser relative w-full max-w-[540px] mx-auto rounded-2xl overflow-hidden bg-white/90 border border-border/60">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/20">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <div className="ml-3 flex-1 rounded-md bg-background/80 px-3 py-1 text-[10px] text-muted-foreground truncate">
          preview.tensorview.cc / your-saas
        </div>
      </div>
      <div className="p-5 space-y-4" style={{ background: "linear-gradient(180deg, oklch(0.98 0.01 350), oklch(1 0 0))" }}>
        <div className="rounded-xl p-4 text-white" style={{ background: "var(--gradient-brand)" }}>
          <div className="text-[10px] uppercase tracking-widest opacity-80">AI Generated</div>
          <div className="mt-1 text-lg font-bold">Launch faster with TensorView</div>
          <div className="mt-3 inline-flex rounded-full bg-white/20 px-3 py-1 text-[11px] font-medium">
            Get started →
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["Design", "Build", "Ship"].map((label) => (
            <div key={label} className="landing-mock-card rounded-lg p-2.5 text-center">
              <div className="mx-auto h-6 w-6 rounded-md btn-brand opacity-90 mb-1.5" />
              <div className="text-[10px] font-medium text-foreground/80">{label}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-2 rounded-full bg-muted" />
          <div className="w-16 h-2 rounded-full bg-brand/40" />
        </div>
      </div>
    </div>
  );
}

function ShowcaseMock({ variant }: { variant: "saas" | "coffee" | "portfolio" | "ai" | "deploy" | "backend" }) {
  const styles: Record<string, { bg: string; accent: string }> = {
    saas: { bg: "linear-gradient(135deg, #fdf2f8, #ede9fe)", accent: "oklch(0.68 0.22 350)" },
    coffee: { bg: "linear-gradient(135deg, #fff7ed, #fef3c7)", accent: "oklch(0.65 0.18 45)" },
    portfolio: { bg: "linear-gradient(135deg, #0f172a, #1e293b)", accent: "oklch(0.75 0.15 250)" },
    ai: { bg: "linear-gradient(135deg, #eef2ff, #e0e7ff)", accent: "oklch(0.6 0.22 295)" },
    deploy: { bg: "linear-gradient(135deg, #ecfdf5, #d1fae5)", accent: "oklch(0.65 0.18 160)" },
    backend: { bg: "linear-gradient(135deg, #f0f9ff, #e0f2fe)", accent: "oklch(0.6 0.16 220)" },
  };
  const s = styles[variant];
  const dark = variant === "portfolio";

  return (
    <div className="absolute inset-0 p-4 flex flex-col" style={{ background: s.bg }}>
      <div className="flex items-center justify-between mb-3">
        <div className={`h-2 w-12 rounded-full ${dark ? "bg-white/20" : "bg-black/10"}`} />
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 w-6 rounded-full ${dark ? "bg-white/15" : "bg-black/8"}`} />
          ))}
        </div>
      </div>
      <div
        className={`rounded-lg p-3 flex-1 ${dark ? "bg-white/5 border border-white/10" : "bg-white/70 border border-black/5"}`}
      >
        <div className="h-2 w-2/3 rounded-full mb-2" style={{ background: s.accent, opacity: 0.7 }} />
        <div className={`h-1.5 w-full rounded-full mb-1 ${dark ? "bg-white/10" : "bg-black/6"}`} />
        <div className={`h-1.5 w-4/5 rounded-full ${dark ? "bg-white/10" : "bg-black/6"}`} />
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <div className="h-8 rounded-md" style={{ background: s.accent, opacity: 0.25 }} />
          <div className={`h-8 rounded-md ${dark ? "bg-white/10" : "bg-black/5"}`} />
        </div>
      </div>
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [prompt, setPrompt] = useState("");

  const suggestions = [t("landing.suggest.1"), t("landing.suggest.2"), t("landing.suggest.3"), t("landing.suggest.4")];

  const start = () => {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", prompt } });
    } else {
      navigate({ to: "/dashboard", search: { prompt } });
    }
  };

  const stats =
    lang === "zh"
      ? [
          { v: "< 30s", l: "生成首屏" },
          { v: "1 句", l: "描述即建站" },
          { v: "0", l: "运维配置" },
          { v: "∞", l: "迭代次数" },
        ]
      : [
          { v: "< 30s", l: "First draft" },
          { v: "1 prompt", l: "To start" },
          { v: "0", l: "DevOps setup" },
          { v: "∞", l: "Iterations" },
        ];

  const steps =
    lang === "zh"
      ? [
          { i: MessageSquare, t: "描述想法", d: "用中文告诉 AI 你要什么产品、什么风格" },
          { i: Layers, t: "实时预览", d: "多页 React 应用即时渲染，边聊边改" },
          { i: Rocket, t: "一键发布", d: "EdgeOne / Vercel / 公开链接，秒级上线" },
        ]
      : [
          { i: MessageSquare, t: "Describe", d: "Tell the AI what you want in plain language" },
          { i: Layers, t: "Preview live", d: "Multi-page React app renders instantly as you chat" },
          { i: Rocket, t: "Publish", d: "Ship to EdgeOne, Vercel, or a public share link" },
        ];

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
      <div className="landing-orb w-[420px] h-[420px] -top-32 -left-24 opacity-60" style={{ background: "oklch(0.85 0.14 350 / 0.5)" }} />
      <div className="landing-orb w-[360px] h-[360px] top-40 -right-20 opacity-50" style={{ background: "oklch(0.88 0.12 295 / 0.45)", animationDelay: "-2s" }} />
      <div className="landing-orb w-[280px] h-[280px] bottom-20 left-1/4 opacity-40" style={{ background: "oklch(0.9 0.1 30 / 0.4)", animationDelay: "-4s" }} />
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <SiteHeader />

      {/* HERO */}
      <section className="relative mx-auto max-w-[1200px] px-6 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground shadow-[var(--shadow-soft)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              {t("landing.badge")}
            </div>

            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.08]">
              {t("landing.title.1")}
              <br />
              <span className="landing-shimmer-text">{t("landing.title.2")}</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {t("landing.subtitle")}
            </p>

            <div className="mt-8 max-w-xl mx-auto lg:mx-0">
              <div className="glass rounded-2xl p-2 shadow-[var(--shadow-card)] ring-1 ring-brand/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 ml-3 text-brand shrink-0" />
                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && prompt && start()}
                    placeholder={t("landing.input.placeholder")}
                    className="flex-1 min-w-0 bg-transparent py-3.5 text-base outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={start}
                    disabled={!prompt}
                    className="rounded-xl btn-brand px-5 py-3.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                  >
                    {lang === "zh" ? "开始" : "Go"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-center lg:justify-start gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPrompt(s)}
                    className="rounded-full glass px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-brand/30 transition border border-transparent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {[t("landing.tag.1"), t("landing.tag.2"), t("landing.tag.3"), t("landing.tag.4")].map((x) => (
                <span key={x} className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-brand" />
                  {x}
                </span>
              ))}
            </div>
          </div>

          <div className="relative hidden sm:block">
            <div
              className="absolute -inset-4 rounded-3xl opacity-40"
              style={{ background: "var(--gradient-glow)", animation: "landing-pulse-ring 4s ease-in-out infinite" }}
            />
            <HeroBrowserMock />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {stats.map((s) => (
            <div key={s.l} className="glass rounded-2xl px-4 py-5 text-center">
              <div className="text-2xl md:text-3xl font-bold text-gradient">{s.v}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative mx-auto max-w-[1100px] px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold">{lang === "zh" ? "三步上线" : "How it works"}</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            {lang === "zh" ? "从想法到可访问的网站，全程在浏览器里完成" : "From idea to live URL — all in your browser"}
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((step, idx) => (
            <div key={step.t} className="relative glass rounded-2xl p-6 hover:shadow-[var(--shadow-soft)] transition">
              <div className="absolute -top-3 left-6 rounded-full btn-brand w-7 h-7 text-xs font-bold grid place-items-center">
                {idx + 1}
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand mt-2">
                <step.i className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{step.t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative mx-auto max-w-[1200px] px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-bold">{t("features.title")}</h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">{t("features.subtitle")}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { i: Wand2, t: t("features.aigen.t"), d: t("features.aigen.d") },
            { i: Code2, t: t("features.preview.t"), d: t("features.preview.d") },
            { i: Database, t: t("features.backend.t"), d: t("features.backend.d") },
            { i: Rocket, t: t("features.deploy.t"), d: t("features.deploy.d") },
            { i: Zap, t: t("features.speed.t"), d: t("features.speed.d") },
            { i: Shield, t: t("features.secure.t"), d: t("features.secure.d") },
          ].map((f) => (
            <div
              key={f.t}
              className="glass rounded-2xl p-6 group hover:border-brand/40 hover:shadow-[var(--shadow-soft)] transition"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl btn-brand">
                <f.i className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase */}
      <section id="showcase" className="relative mx-auto max-w-[1200px] px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-bold">{t("showcase.title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("showcase.subtitle")}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {(
            [
              { t: t("landing.suggest.1"), v: "saas" as const },
              { t: t("landing.suggest.3"), v: "coffee" as const },
              { t: t("landing.suggest.4"), v: "ai" as const },
              { t: t("landing.suggest.2"), v: "portfolio" as const },
              { t: t("features.deploy.t"), v: "deploy" as const },
              { t: t("features.backend.t"), v: "backend" as const },
            ] as const
          ).map((c) => (
            <div
              key={c.t}
              className="glass rounded-2xl overflow-hidden group cursor-default hover:shadow-[var(--shadow-card)] transition"
            >
              <div className="aspect-[16/10] relative overflow-hidden">
                <ShowcaseMock variant={c.v} />
                <div className="absolute bottom-3 left-3 glass rounded-lg px-2.5 py-1 text-[10px] font-medium flex items-center gap-1">
                  <MousePointerClick className="h-3 w-3 text-brand" />
                  {t("showcase.preview")}
                </div>
              </div>
              <div className="p-4 border-t border-border/40">
                <div className="font-semibold text-sm">{c.t}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative mx-auto max-w-[1200px] px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-bold">{t("pricing.title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3 max-w-4xl mx-auto">
          {(lang === "zh"
            ? [
                { name: "免费", price: "¥0", desc: "适合体验和小项目", cta: "开始使用", features: ["每日 AI 积分", "无限项目", "社区支持"], highlight: false },
                { name: "专业", price: "¥99", desc: "适合个人创作者", cta: "升级专业版", features: ["更多 AI 生成", "自定义域名", "优先支持"], highlight: true },
                { name: "团队", price: "¥299", desc: "适合团队协作", cta: "联系销售", features: ["无限 AI 生成", "团队协作", "专属客服"], highlight: false },
              ]
            : [
                { name: "Free", price: "$0", desc: "Great for trying things out", cta: "Get started", features: ["Daily AI credits", "Unlimited projects", "Community support"], highlight: false },
                { name: "Pro", price: "$14", desc: "For individual creators", cta: "Upgrade to Pro", features: ["More generations", "Custom domain", "Priority support"], highlight: true },
                { name: "Team", price: "$39", desc: "For collaborating teams", cta: "Contact sales", features: ["Unlimited generations", "Team collaboration", "Dedicated support"], highlight: false },
              ]
          ).map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl p-7 transition hover:-translate-y-0.5 ${p.highlight ? "glass border-brand/50 shadow-[var(--shadow-glow)] scale-[1.02]" : "glass"}`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full btn-brand px-3 py-1 text-xs font-semibold">
                  {t("pricing.popular")}
                </div>
              )}
              <div className="text-sm text-muted-foreground">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{p.price}</span>
                <span className="text-sm text-muted-foreground">{t("pricing.month")}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              <ul className="mt-5 space-y-2.5 text-sm">
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
                className={`mt-6 block text-center rounded-full py-2.5 text-sm font-semibold transition ${
                  p.highlight ? "btn-brand" : "border border-border hover:bg-accent/30"
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
          <h2 className="text-4xl md:text-5xl font-bold">{t("faq.title")}</h2>
        </div>
        <div className="space-y-3">
          {(lang === "zh"
            ? [
                { q: "我需要会编程吗？", a: "完全不需要。用中文描述你想要的网站，AI 会帮你生成全部代码。" },
                { q: "生成的网页可以发布吗？", a: "可以。每个项目都有专属预览和发布链接，支持绑定自定义域名。" },
                { q: "能修改生成的内容吗？", a: "当然。你可以在聊天里继续描述修改，AI 会增量更新页面。" },
                { q: "免费额度够用吗？", a: "免费版有每日积分补给，适合体验。深度使用建议升级专业版。" },
                { q: "数据安全吗？", a: "全部数据加密存储，启用了行级权限控制，只有你能访问自己的项目。" },
              ]
            : [
                { q: "Do I need to code?", a: "No. Describe the website you want in plain language and the AI writes all the code." },
                { q: "Can I publish what I generate?", a: "Yes. Every project gets a preview and publish link, with custom domain support." },
                { q: "Can I edit the generated site?", a: "Keep chatting with the AI and it will update pages incrementally." },
                { q: "Is the free quota enough?", a: "Free tier includes daily credit refills — great for trying things out." },
                { q: "Is my data secure?", a: "Encrypted at rest with row-level security so only you can access your projects." },
              ]
          ).map((f) => (
            <details key={f.q} className="glass rounded-2xl px-5 py-4 group open:shadow-[var(--shadow-soft)]">
              <summary className="cursor-pointer font-medium flex items-center justify-between list-none">
                {f.q}
                <span className="text-brand text-xl group-open:rotate-45 transition ml-4 shrink-0">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-[1100px] px-6 pb-24">
        <div className="rounded-3xl glass p-10 md:p-14 text-center relative overflow-hidden border border-brand/20">
          <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="relative">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl btn-brand shadow-[var(--shadow-glow)]">
              <Globe className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-3xl md:text-5xl font-bold">{t("cta.title")}</h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">{t("cta.subtitle")}</p>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="mt-8 inline-flex items-center gap-2 rounded-full btn-brand px-8 py-3.5 text-base font-semibold"
            >
              {t("cta.button")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
