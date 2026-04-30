import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Sparkles, Send, Loader2, ArrowLeft, Code2, Eye, Download, Share2, Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { generateWebsite, toggleProjectPublic } from "@/server/ai.functions";
import { toast } from "sonner";

const searchSchema = z.object({
  initial: z.string().optional(),
});

export const Route = createFileRoute("/project/$projectId")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ProjectEditor,
});

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

const PLACEHOLDER_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>预览</title>
<style>body{margin:0;display:grid;place-items:center;height:100vh;font-family:system-ui;background:linear-gradient(135deg,#1a1530,#0f0a20);color:#fff}
.box{text-align:center;opacity:.6}
.dot{display:inline-block;width:8px;height:8px;background:#e879f9;border-radius:50%;margin:0 2px;animation:b 1.4s infinite}
.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
@keyframes b{0%,80%,100%{opacity:.2}40%{opacity:1}}</style>
</head><body><div class="box"><div style="font-size:14px;letter-spacing:2px">等待生成</div><div style="margin-top:8px"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div></body></html>`;

function ProjectEditor() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const { user, loading: authLoading, session } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<{
    name: string;
    preview_html: string | null;
    is_public: boolean;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const initialFiredRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("projects").select("name, preview_html, is_public").eq("id", projectId).maybeSingle(),
      supabase.from("messages").select("*").eq("project_id", projectId).order("created_at"),
    ]).then(([p, m]) => {
      if (p.error || !p.data) {
        toast.error("项目未找到");
        navigate({ to: "/dashboard", search: {} });
        return;
      }
      setProject(p.data);
      setMessages(m.data ?? []);
    });
  }, [user, projectId, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || sending || !session) return;
    setInput("");
    setSending(true);

    const tempId = "tmp-" + Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: prompt, created_at: new Date().toISOString() },
    ]);

    try {
      const result = await generateWebsite({
        data: { projectId, prompt },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const [{ data: msgs }, { data: proj }] = await Promise.all([
        supabase.from("messages").select("*").eq("project_id", projectId).order("created_at"),
        supabase.from("projects").select("name, preview_html, is_public").eq("id", projectId).single(),
      ]);
      setMessages(msgs ?? []);
      if (proj) setProject(proj);
      if (result.html) toast.success("已更新预览");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "生成失败";
      toast.error(msg);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (
      !initialFiredRef.current &&
      project &&
      session &&
      messages.length === 0 &&
      search.initial &&
      search.initial.trim()
    ) {
      initialFiredRef.current = true;
      send(search.initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, session, messages.length, search.initial]);

  const html = project?.preview_html ?? PLACEHOLDER_HTML;

  const download = () => {
    if (!project?.preview_html) return;
    const blob = new Blob([project.preview_html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const togglePublic = async (next: boolean) => {
    if (!session || !project) return;
    try {
      await toggleProjectPublic({
        data: { projectId, isPublic: next },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setProject({ ...project, is_public: next });
      toast.success(next ? "已设为公开" : "已设为私有");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "切换失败");
    }
  };

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${projectId}` : "";

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("复制失败");
    }
  };

  if (authLoading || !project) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      <header className="border-b border-border/40 backdrop-blur-xl bg-background/60 px-4 py-3 flex items-center gap-3 shrink-0">
        <Link to="/dashboard" search={{}} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent/50 transition">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="grid h-8 w-8 place-items-center rounded-lg btn-brand">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{project.name}</div>
          <div className="text-xs text-muted-foreground">特挠率i额外项目</div>
        </div>
        <div className="flex items-center rounded-full glass p-1">
          <button
            onClick={() => setView("preview")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${view === "preview" ? "btn-brand" : "text-muted-foreground"}`}
          >
            <Eye className="h-3 w-3" /> 预览
          </button>
          <button
            onClick={() => setView("code")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${view === "code" ? "btn-brand" : "text-muted-foreground"}`}
          >
            <Code2 className="h-3 w-3" /> 代码
          </button>
        </div>

        {/* Share */}
        <div className="relative">
          <button
            onClick={() => setShareOpen((o) => !o)}
            className="rounded-full glass px-3 py-1.5 text-xs hover:border-brand/40 transition flex items-center gap-1.5"
          >
            <Share2 className="h-3 w-3" /> 分享
          </button>
          {shareOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 glass rounded-2xl p-4 shadow-[var(--shadow-card)] z-50">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">公开访问</div>
                <button
                  onClick={() => togglePublic(!project.is_public)}
                  className={`relative h-5 w-9 rounded-full transition ${project.is_public ? "bg-brand" : "bg-muted"}`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${project.is_public ? "left-[18px]" : "left-0.5"}`}
                  />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {project.is_public ? "任何持有链接的人都可以查看你的页面。" : "仅你自己可以访问。"}
              </p>
              {project.is_public && (
                <>
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-input border border-border px-2 py-1.5">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 bg-transparent text-xs outline-none truncate"
                    />
                    <button onClick={copyShare} className="rounded-md btn-brand p-1.5">
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-center text-xs text-brand hover:underline"
                  >
                    在新标签页打开 ↗
                  </a>
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={download}
          disabled={!project.preview_html}
          className="rounded-full glass px-3 py-1.5 text-xs hover:border-brand/40 transition disabled:opacity-40 flex items-center gap-1.5"
        >
          <Download className="h-3 w-3" /> 下载
        </button>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] min-h-0">
        <aside className="border-r border-border/40 flex flex-col min-h-0 bg-background/40">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !sending && (
              <div className="text-center text-sm text-muted-foreground py-12">
                <Sparkles className="h-6 w-6 mx-auto mb-2 text-brand" />
                告诉 AI 你想做什么样的网页
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user" ? "btn-brand" : "glass"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&_pre]:bg-black/40 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_code]:text-xs">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content.replace(/```html[\s\S]*?```/gi, "✨ _已生成网页 — 见右侧预览_")}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="glass rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  <span className="text-muted-foreground">AI 正在生成...</span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="p-3 border-t border-border/40 bg-background/60"
          >
            <div className="glass rounded-2xl p-1.5 flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="继续描述要修改什么..."
                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground resize-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="rounded-xl btn-brand p-2 disabled:opacity-40 self-stretch grid place-items-center px-3"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </aside>

        <main className="relative min-h-0">
          {view === "preview" ? (
            <iframe
              key={html.length}
              srcDoc={html}
              title="preview"
              sandbox="allow-scripts"
              className="w-full h-full border-0 bg-white"
            />
          ) : (
            <pre className="w-full h-full overflow-auto p-4 text-xs bg-background/80 m-0">
              <code>{project.preview_html ?? "// 还没有生成代码"}</code>
            </pre>
          )}
        </main>
      </div>
    </div>
  );
}
