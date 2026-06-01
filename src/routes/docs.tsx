import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Wand2, Edit3, Share2, Code2, Database, BookOpen, ArrowRight, Clock } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { DOC_ARTICLES } from "@/content/docs-articles";
import { useT } from "@/lib/i18n";
import { pickLang, localizedMeta, localizedLinks } from "@/lib/seo-head";

export const Route = createFileRoute("/docs")({
  loader: ({ context }) => ({ lang: (context as { lang?: "zh" | "en" }).lang ?? "en" }),
  head: ({ loaderData }) => {
    const lang = pickLang(loaderData);
    return {
      meta: localizedMeta(lang, "seo.docs.title", "seo.docs.desc", "/docs"),
      links: localizedLinks("/docs"),
    };
  },
  component: DocsPage,
});

function DocsPage() {
  const t = useT();
  const SECTIONS = [
    { icon: Wand2, title: t("docs.section1.t"), body: t("docs.section1.d") },
    { icon: Edit3, title: t("docs.section2.t"), body: t("docs.section2.d") },
    { icon: Code2, title: t("docs.section3.t"), body: t("docs.section3.d") },
    { icon: Share2, title: t("docs.section4.t"), body: t("docs.section4.d") },
    { icon: Database, title: t("docs.section5.t"), body: t("docs.section5.d") },
  ];

  return (
    <div className="min-h-screen relative" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="relative">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-brand" /> {t("docs.badge")}
            </div>
            <h1 className="mt-5 text-4xl md:text-5xl font-bold">
              {t("docs.title.1")}<span className="text-gradient">{t("docs.title.2")}</span>
            </h1>
            <p className="mt-4 text-muted-foreground">{t("docs.subtitle")}</p>
          </div>

          <div className="mt-14 space-y-4">
            {SECTIONS.map((s) => (
              <div key={s.title} className="glass rounded-2xl p-6 flex gap-4 group hover:border-brand/40 transition">
                <span className="grid h-10 w-10 place-items-center rounded-xl btn-brand shrink-0">
                  <s.icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">{s.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <section className="mt-16">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brand" />
              <h2 className="text-lg font-semibold">{t("docs.tutorials.title")}</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("docs.tutorials.sub")}</p>
            {t("docs.englishNotice") && (
              <p className="mt-2 text-xs text-amber-300/80">{t("docs.englishNotice")}</p>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {DOC_ARTICLES.map((a) => (
                <Link
                  key={a.slug}
                  to="/docs/$slug"
                  params={{ slug: a.slug }}
                  className="glass rounded-2xl p-6 group hover:border-brand/40 transition flex flex-col"
                >
                  <h3 className="font-semibold leading-snug group-hover:text-brand transition">{a.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> {a.readMinutes} {t("docs.minutes")}
                    </span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <div className="mt-12 rounded-3xl glass p-8 text-center">
            <h2 className="text-xl font-bold">{t("docs.cta.title")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("docs.cta.sub")}</p>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="mt-5 inline-flex rounded-full btn-brand px-6 py-2.5 text-sm font-semibold"
            >
              {t("docs.cta.button")}
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
