import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Wand2, Edit3, Share2, Code2, Database } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "使用文档 — 特挠率i额外" },
      { name: "description", content: "了解如何使用特挠率i额外用一句话生成、编辑、发布你的网页。" },
      { property: "og:title", content: "使用文档 — 特挠率i额外" },
    ],
  }),
  component: DocsPage,
});

const SECTIONS = [
  {
    icon: Wand2,
    title: "1. 创建你的第一个项目",
    body: "登录后在仪表盘输入一句话描述你想要的网页，AI 会立即生成完整 HTML。",
  },
  {
    icon: Edit3,
    title: "2. 用对话持续优化",
    body: "在项目编辑器左侧聊天，告诉 AI 想修改的内容。AI 会基于上一版做最小改动。",
  },
  {
    icon: Code2,
    title: "3. 查看与导出代码",
    body: "顶栏切换「代码」视图查看生成的 HTML，点击「下载」导出单文件。",
  },
  {
    icon: Share2,
    title: "4. 公开分享你的页面",
    body: "在编辑器中点击「分享」开关，生成一个公开链接，任何人都能直接访问。",
  },
  {
    icon: Database,
    title: "5. 接入自有 AI 模型",
    body: "默认使用平台 AI；如需接入自有 OpenAI / Claude 等模型，在后端设置环境变量 CUSTOM_AI_API_KEY、CUSTOM_AI_BASE_URL、CUSTOM_AI_MODEL 即可。",
  },
];

function DocsPage() {
  return (
    <div className="min-h-screen relative" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="relative">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-brand" /> 5 分钟上手
            </div>
            <h1 className="mt-5 text-4xl md:text-5xl font-bold">
              使用<span className="text-gradient">文档</span>
            </h1>
            <p className="mt-4 text-muted-foreground">从注册到发布，了解特挠率i额外的核心工作流。</p>
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

          <div className="mt-12 rounded-3xl glass p-8 text-center">
            <h2 className="text-xl font-bold">准备好开始了吗？</h2>
            <p className="mt-2 text-sm text-muted-foreground">注册免费账户，几秒钟后就能看到 AI 生成的第一个网页。</p>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="mt-5 inline-flex rounded-full btn-brand px-6 py-2.5 text-sm font-semibold"
            >
              免费开始
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
