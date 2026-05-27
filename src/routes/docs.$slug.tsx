import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { DOC_ARTICLES, getArticle } from "@/content/docs-articles";
import { renderMarkdown } from "@/lib/markdown";

export const Route = createFileRoute("/docs/$slug")({
  loader: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ params, loaderData }) => {
    const a = loaderData?.article ?? getArticle(params.slug);
    if (!a) {
      return {
        meta: [{ title: "文章未找到 | TensorView AI Docs" }],
      };
    }
    const url = `https://ai.tensorview.cc/docs/${a.slug}`;
    return {
      meta: [
        { title: `${a.title} | TensorView AI Docs` },
        { name: "description", content: a.description },
        { name: "keywords", content: a.keywords },
        { property: "og:title", content: a.title },
        { property: "og:description", content: a.description },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { property: "article:published_time", content: a.datePublished },
        { property: "article:modified_time", content: a.dateModified },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: a.title },
        { name: "twitter:description", content: a.description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: a.title,
            description: a.description,
            datePublished: a.datePublished,
            dateModified: a.dateModified,
            inLanguage: "zh-CN",
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            author: { "@type": "Organization", name: "TensorView AI" },
            publisher: {
              "@type": "Organization",
              name: "TensorView AI",
              url: "https://ai.tensorview.cc",
            },
          }),
        },
      ],
    };
  },
  component: DocArticlePage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">文章未找到</h1>
        <Link to="/docs" className="mt-4 inline-block text-brand underline">
          返回文档首页
        </Link>
      </div>
    </div>
  ),
});

function DocArticlePage() {
  const { article } = Route.useLoaderData();
  const related = DOC_ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 2);

  return (
    <div className="min-h-screen relative" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="relative">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-16">
          <Link
            to="/docs"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" /> 所有文档
          </Link>

          <article className="mt-6">
            <header className="border-b border-border/40 pb-6">
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">{article.title}</h1>
              <p className="mt-3 text-muted-foreground">{article.description}</p>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {article.readMinutes} 分钟阅读
                </span>
                <span>更新于 {article.dateModified}</span>
              </div>
            </header>

            <div className="mt-2">{renderMarkdown(article.body)}</div>
          </article>

          {related.length > 0 && (
            <aside className="mt-16 border-t border-border/40 pt-10">
              <h2 className="text-lg font-semibold">继续阅读</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {related.map((a) => (
                  <Link
                    key={a.slug}
                    to="/docs/$slug"
                    params={{ slug: a.slug }}
                    className="glass rounded-2xl p-5 hover:border-brand/40 transition"
                  >
                    <h3 className="font-semibold leading-snug">{a.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                  </Link>
                ))}
              </div>
            </aside>
          )}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
