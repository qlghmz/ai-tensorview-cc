import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  Sparkles,
  Send,
  Loader2,
  ArrowLeft,
  Code2,
  Eye,
  Download,
  Share2,
  Check,
  Copy,
  MessageSquare,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { lovableBundleSchema, type LovableBundle } from "@/lib/lovable-bundle";
import { ClientLovableSandpack } from "@/components/lovable/ClientLovableSandpack";
import { toggleProjectPublic } from "@/fn/website-ai";
import { toast } from "sonner";

const searchSchema = z.object({
  initial: z.string().optional(),
});

export const Route = createFileRoute("/project/$projectId")({
  validateSearch: (s) => searchSchema.parse(s),
  /** Sandpack 等依赖仅在浏览器可用；禁止服务端 loadRouteChunk，避免 `self is not defined`。 */
  ssr: false,
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

type MobileTab = "chat" | "canvas";

function ProjectEditor() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const { user, loading: authLoading, session } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<{
    name: string;
    preview_html: string | null;
    preview_sandpack: Json | null;
    is_public: boolean;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [streamAssistId, setStreamAssistId] = useState<string | null>(null);
  const initialFiredRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lovableBundle = useMemo((): LovableBundle | null => {
    const raw = project?.preview_sandpack;
    if (raw == null) return null;
    const r = lovableBundleSchema.safeParse(raw);
    return r.success ? r.data : null;
  }, [project?.preview_sandpack]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("projects").select("name, preview_html, preview_sandpack, is_public").eq("id", projectId).maybeSingle(),
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

  const reloadThread = async () => {
    const [{ data: msgs }, { data: proj }] = await Promise.all([
      supabase.from("messages").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("projects").select("name, preview_html, preview_sandpack, is_public").eq("id", projectId).single(),
    ]);
    setMessages(msgs ?? []);
    if (proj) setProject(proj);
  };

  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || sending || !session) return;
    setInput("");
    setSending(true);

    const tempUserId = "tmp-" + Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: prompt, created_at: new Date().toISOString() },
    ]);

    const asstId = "tmp-asst-" + Date.now();
    setStreamAssistId(asstId);
    setMessages((prev) => [
      ...prev,
      {
        id: asstId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ projectId, prompt }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `请求失败（${res.status}）`);
      }

      if (!res.body) throw new Error("无响应流");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let lineBuf = "";
      let gotFinalSandpack = false;
      let pendingSandpack: Json | null = null;
      let finalReply: string = "";

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let evt: {
          type?: string;
          content?: string;
          sandpack?: unknown;
          reply?: string;
          message?: string;
        };
        try {
          evt = JSON.parse(trimmed) as typeof evt;
        } catch {
          return;
        }
        // 生成期间不展示具体代码内容，仅作为状态信号；保留最后的 reply 用于完成后展示。
        if (evt.type === "preview" && evt.sandpack != null) {
          const parsed = lovableBundleSchema.safeParse(evt.sandpack);
          if (parsed.success) {
            pendingSandpack = JSON.parse(JSON.stringify(parsed.data)) as Json;
          }
        }
        if (evt.type === "final") {
          if (evt.sandpack != null) {
            const parsed = lovableBundleSchema.safeParse(evt.sandpack);
            if (parsed.success) {
              pendingSandpack = JSON.parse(JSON.stringify(parsed.data)) as Json;
              gotFinalSandpack = true;
            }
          }
          if (evt.reply) finalReply = evt.reply;
        }
        if (evt.type === "error" && evt.message) {
          toast.error(evt.message);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = lineBuf.indexOf("\n")) !== -1) {
          const line = lineBuf.slice(0, nl);
          lineBuf = lineBuf.slice(nl + 1);
          handleLine(line);
        }
      }
      if (lineBuf.trim()) handleLine(lineBuf);

      // 一次性更新预览，避免中途闪烁
      if (pendingSandpack) {
        const sp = pendingSandpack;
        setProject((p) => (p ? { ...p, preview_sandpack: sp, preview_html: null } : p));
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
          setMobileTab("canvas");
        }
      }

      // 用最终回复替换占位
      const cleanReply = finalReply
        ? finalReply
            .replace(/```lovable[\s\S]*?```/gi, "✨ _已生成网页 — 见预览面板_")
            .replace(/```html[\s\S]*?```/gi, "✨ _已生成网页 — 见预览面板_")
        : gotFinalSandpack
          ? "✨ 已生成网页 — 见预览面板"
          : "生成已完成。";
      setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: cleanReply } : m)));

      await reloadThread();
      if (gotFinalSandpack) toast.success("已更新预览");
      else if (!finalReply) toast.message("生成结束，但未得到可用的页面，请补充要求重试");
      else if (!finalReply) toast.message("生成结束，但未得到可用的页面，请补充要求重试");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "生成失败";
      toast.error(msg);
      // 保留用户消息，把占位 assistant 替换成错误说明
      setMessages((prev) =>
        prev.map((m) => (m.id === asstId ? { ...m, content: `⚠️ 生成失败：${msg}` } : m)),
      );
    } finally {
      setSending(false);
      setStreamAssistId(null);
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
    if (!project) return;
    if (lovableBundle) {
      const blob = new Blob([JSON.stringify(lovableBundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}.lovable.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!project.preview_html) return;
    const blob = new Blob([project.preview_html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canDownload = !!(lovableBundle || project?.preview_html);

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

  const canvasPreview = (
    <div className="absolute inset-0 p-3 sm:p-4 flex flex-col min-h-0">
      <div className="flex-1 min-h-0 rounded-2xl border border-border/60 bg-[#0b0a14] overflow-hidden shadow-[var(--shadow-card)] relative flex flex-col">
        {lovableBundle ? (
          <div className="flex-1 min-h-0 flex flex-col p-2">
            <ClientLovableSandpack
              bundle={lovableBundle}
              view={view === "preview" ? "preview" : "code"}
              readOnly={view === "code"}
            />
          </div>
        ) : view === "preview" ? (
          <iframe
            key={html.length}
            srcDoc={html}
            title="preview"
            sandbox="allow-scripts"
            className="absolute inset-0 w-full h-full border-0 bg-white"
          />
        ) : (
          <pre className="absolute inset-0 overflow-auto p-3 sm:p-4 text-[11px] sm:text-xs bg-[#0b0a14] m-0">
            <code className="break-words whitespace-pre-wrap text-muted-foreground">
              {project.preview_html ?? "// 还没有生成代码"}
            </code>
          </pre>
        )}
      </div>
    </div>
  );

  const previewCodeToggle = (
    <div className="flex items-center rounded-full glass p-1 shrink-0">
      <button
        type="button"
        onClick={() => setView("preview")}
        className={`flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs ${view === "preview" ? "btn-brand" : "text-muted-foreground"}`}
      >
        <Eye className="h-3 w-3 shrink-0" />
        <span className="hidden sm:inline">预览</span>
      </button>
      <button
        type="button"
        onClick={() => setView("code")}
        className={`flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs ${view === "code" ? "btn-brand" : "text-muted-foreground"}`}
      >
        <Code2 className="h-3 w-3 shrink-0" />
        <span className="hidden sm:inline">代码</span>
      </button>
    </div>
  );

  const chatPanel = (
    <aside className="lg:border-r lg:border-border/40 flex flex-col min-h-0 bg-background/40 h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0">
        {messages.length === 0 && !sending && (
          <div className="text-center text-sm text-muted-foreground py-8 sm:py-12 px-2">
            <Sparkles className="h-6 w-6 mx-auto mb-2 text-brand" />
            告诉 AI 你想做什么样的网页
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[min(88%,520px)] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm ${
                m.role === "user" ? "btn-brand" : "glass"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_pre]:bg-black/40 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_code]:text-xs">
                  {m.id === streamAssistId && !m.content.trim() ? (
                    <GeneratingStatus />
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content
                        .replace(/```lovable[\s\S]*?```/gi, "✨ _已生成网页 — 见预览面板_")
                        .replace(/```html[\s\S]*?```/gi, "✨ _已生成网页 — 见预览面板_")}
                    </ReactMarkdown>
                  )}
                </div>
              ) : (
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="p-2 sm:p-3 border-t border-border/40 bg-background/60 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
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
            className="flex-1 bg-transparent px-2 sm:px-3 py-2 text-sm outline-none placeholder:text-muted-foreground resize-none min-h-[44px]"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="rounded-xl btn-brand p-2 disabled:opacity-40 self-stretch grid place-items-center px-3 min-w-[44px]"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </aside>
  );

  return (
    <div
      className="min-h-[100dvh] h-[100dvh] flex flex-col overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      <header className="border-b border-border/40 backdrop-blur-xl bg-background/60 px-2 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 basis-[200px]">
          <Link
            to="/dashboard"
            search={{}}
            className="grid h-9 w-9 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-lg hover:bg-accent/50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="grid h-9 w-9 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-lg btn-brand">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate text-sm sm:text-base">{project.name}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">特挠率i额外项目</div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 ml-auto flex-wrap justify-end">
          {previewCodeToggle}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShareOpen((o) => !o)}
              className="rounded-full glass px-3 py-1.5 text-xs hover:border-brand/40 transition flex items-center gap-1.5"
            >
              <Share2 className="h-3 w-3" /> 分享
            </button>
            {shareOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] glass rounded-2xl p-4 shadow-[var(--shadow-card)] z-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">公开访问</div>
                  <button
                    type="button"
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
                        className="flex-1 bg-transparent text-xs outline-none truncate min-w-0"
                      />
                      <button type="button" onClick={copyShare} className="rounded-md btn-brand p-1.5 shrink-0">
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
            type="button"
            onClick={download}
            disabled={!canDownload}
            className="rounded-full glass px-3 py-1.5 text-xs hover:border-brand/40 transition disabled:opacity-40 flex items-center gap-1.5"
          >
            <Download className="h-3 w-3" /> 下载
          </button>
        </div>

        <div className="flex lg:hidden items-center gap-1.5 ml-auto">
          {previewCodeToggle}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShareOpen((o) => !o)}
              className="rounded-full glass px-2.5 py-1.5 text-[11px] flex items-center gap-1"
            >
              <Share2 className="h-3 w-3" />
              <span className="hidden sm:inline">分享</span>
            </button>
            {shareOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-1rem))] glass rounded-2xl p-3 shadow-[var(--shadow-card)] z-50">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium">公开访问</div>
                  <button
                    type="button"
                    onClick={() => togglePublic(!project.is_public)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition ${project.is_public ? "bg-brand" : "bg-muted"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${project.is_public ? "left-[18px]" : "left-0.5"}`}
                    />
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
                  {project.is_public ? "链接可公开访问。" : "仅自己可访问。"}
                </p>
                {project.is_public && (
                  <div className="mt-2 flex items-center gap-1 rounded-lg bg-input border border-border px-2 py-1">
                    <input readOnly value={shareUrl} className="flex-1 min-w-0 bg-transparent text-[10px] outline-none truncate" />
                    <button type="button" onClick={copyShare} className="rounded-md btn-brand p-1 shrink-0">
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={download}
            disabled={!canDownload}
            className="rounded-full glass px-2.5 py-1.5 text-[11px] disabled:opacity-40 flex items-center gap-1"
          >
            <Download className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* Desktop + tablet: two columns */}
      <div className="hidden lg:grid flex-1 grid-cols-[minmax(280px,420px)_1fr] min-h-0">
        {chatPanel}
        <main className="relative min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 relative">{canvasPreview}</div>
        </main>
      </div>

      {/* Mobile: tabbed */}
      <div className="flex lg:hidden flex-1 flex-col min-h-0 pb-[calc(3.25rem+env(safe-area-inset-bottom))]">
        <div className={`flex-1 min-h-0 flex flex-col ${mobileTab === "chat" ? "" : "hidden"}`}>{chatPanel}</div>
        <div
          className={`flex-1 min-h-0 flex flex-col overflow-hidden ${mobileTab === "canvas" ? "" : "hidden"}`}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-background/40 shrink-0">
            {previewCodeToggle}
          </div>
          <div className="flex-1 min-h-0 relative">{canvasPreview}</div>
        </div>
      </div>

      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/90 backdrop-blur-xl flex justify-around items-center pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] px-1 safe-area-pb"
        aria-label="主面板切换"
      >
        {(
          [
            { id: "chat" as const, icon: MessageSquare, label: "对话" },
            { id: "canvas" as const, icon: Eye, label: "预览 / 代码" },
          ] as const
        ).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={`flex flex-col items-center gap-0.5 py-2 px-4 rounded-xl text-[10px] font-medium transition flex-1 max-w-[50%] ${
              mobileTab === id ? "text-brand bg-brand/10" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
