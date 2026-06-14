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
  MessageSquare,
  GitBranch,
  History,
  Users,
  Database,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { uiBundleSchema, sanitizeUiBundle, type UiBundle } from "@/lib/ui-bundle";
import { ClientSandpackPreview } from "@/components/preview/ClientSandpackPreview";
import { RenameProjectDialog } from "@/components/RenameProjectDialog";
import { PushToRepoDialog } from "@/components/PushToRepoDialog";
import { PublishDialog } from "@/components/PublishDialog";
import { CreditBadge } from "@/components/CreditBadge";
import { MobileGenerationHint } from "@/components/MobileWarningBanner";
import { VersionHistoryPanel } from "@/components/VersionHistoryPanel";
import { VersionDiffPanel } from "@/components/VersionDiffPanel";
import { StylePicker } from "@/components/StylePicker";
import { ReferenceInputBar } from "@/components/ReferenceInputBar";
import { ExportMenu } from "@/components/ExportMenu";
import { ShareTeamDialog } from "@/components/ShareTeamDialog";
import { SchemaHelperPanel } from "@/components/SchemaHelperPanel";
import { applyStyleToPrompt } from "@/lib/ui-styles";
import type { ReferenceInput } from "@/lib/reference-vision";
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

const STATUS_STEPS = [
  "正在理解你的需求",
  "正在规划页面与路由",
  "正在生成 React 组件",
  "正在组装多页面预览",
  "正在保存并刷新预览",
];

function GeneratingStatus() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1 < STATUS_STEPS.length ? i + 1 : i));
    }, 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
        <span className="text-sm">{STATUS_STEPS[idx]}…</span>
      </div>
      <div className="flex flex-col gap-1 text-[11px] text-muted-foreground/80">
        {STATUS_STEPS.slice(0, idx).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <Check className="h-3 w-3 text-brand/80" />
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectEditor() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const { user, loading: authLoading, session } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<{
    name: string;
    description: string | null;
    preview_html: string | null;
    preview_sandpack: Json | null;
    is_public: boolean;
    public_slug: string | null;
    has_snapshot: boolean;
    published_url: string | null;
  } | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [publishOpen, setPublishOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [reference, setReference] = useState<ReferenceInput>({});
  const [streamAssistId, setStreamAssistId] = useState<string | null>(null);
  const initialFiredRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const uiBundle = useMemo((): UiBundle | null => {
    const raw = project?.preview_sandpack;
    if (raw == null) return null;
    const r = uiBundleSchema.safeParse(raw);
    return r.success ? sanitizeUiBundle(r.data) : null;
  }, [project?.preview_sandpack]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("projects").select("name, description, preview_html, preview_sandpack, is_public, public_slug, published_html, published_url").eq("id", projectId).maybeSingle(),
      supabase.from("messages").select("*").eq("project_id", projectId).order("created_at"),
    ]).then(([p, m]) => {
      if (p.error || !p.data) {
        toast.error("项目未找到");
        navigate({ to: "/dashboard", search: {} });
        return;
      }
      const d = p.data;
      setProject({
        name: d.name,
        description: d.description,
        preview_html: d.preview_html,
        preview_sandpack: d.preview_sandpack,
        is_public: d.is_public,
        public_slug: d.public_slug ?? null,
        has_snapshot: !!d.published_html,
        published_url: d.published_url ?? null,
      });
      setMessages(m.data ?? []);
    });
  }, [user, projectId, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const reloadThread = async () => {
    const [{ data: msgs }, { data: proj }] = await Promise.all([
      supabase.from("messages").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("projects").select("name, description, preview_html, preview_sandpack, is_public, public_slug, published_html, published_url").eq("id", projectId).single(),
    ]);
    setMessages(msgs ?? []);
    if (proj) {
      setProject({
        name: proj.name,
        description: proj.description,
        preview_html: proj.preview_html,
        preview_sandpack: proj.preview_sandpack,
        is_public: proj.is_public,
        public_slug: proj.public_slug ?? null,
        has_snapshot: !!proj.published_html,
        published_url: proj.published_url ?? null,
      });
    }
  };

  useEffect(() => {
    if (!project || sending || project.preview_sandpack || project.preview_html) return;
    const timer = window.setInterval(() => {
      void reloadThread();
    }, 3000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.preview_sandpack, project?.preview_html, sending]);

  const send = async (text?: string) => {
    const rawPrompt = (text ?? input).trim();
    if (!rawPrompt || sending || !session) return;
    const prompt = applyStyleToPrompt(rawPrompt, styleId);
    setInput("");
    setSending(true);
    const refSnapshot = { ...reference };

    const tempUserId = "tmp-" + Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: rawPrompt, created_at: new Date().toISOString() },
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

    // 90 秒无任何数据则视为流卡死，主动中断
    const ac = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        ac.abort(new Error("连接超时：90 秒未收到 AI 数据，请重试"));
      }, 90_000);
    };

    try {
      resetIdle();
      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          projectId,
          prompt,
          referenceImage: refSnapshot.imageDataUrl,
          figmaUrl: refSnapshot.figmaUrl,
        }),
        signal: ac.signal,
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
          const parsed = uiBundleSchema.safeParse(evt.sandpack);
          if (parsed.success) {
            pendingSandpack = JSON.parse(JSON.stringify(sanitizeUiBundle(parsed.data))) as Json;
          }
        }
        if (evt.type === "final") {
          if (evt.sandpack != null) {
            const parsed = uiBundleSchema.safeParse(evt.sandpack);
            if (parsed.success) {
              pendingSandpack = JSON.parse(JSON.stringify(sanitizeUiBundle(parsed.data))) as Json;
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
        resetIdle();
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
            .replace(/```(?:uibundle|lovable)[\s\S]*?```/gi, "✨ _已生成网页 — 见预览面板_")
            .replace(/```html[\s\S]*?```/gi, "✨ _已生成网页 — 见预览面板_")
        : gotFinalSandpack
          ? "✨ 已生成网页 — 见预览面板"
          : "生成已完成。";
      setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: cleanReply } : m)));

      await reloadThread();
      if (gotFinalSandpack) toast.success("已更新预览");
      else if (!finalReply) toast.message("生成结束，但未得到可用的页面，请补充要求重试");
      setReference({});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "生成失败";
      toast.error(msg);
      // 保留用户消息，把占位 assistant 替换成错误说明
      setMessages((prev) =>
        prev.map((m) => (m.id === asstId ? { ...m, content: `⚠️ 生成失败：${msg}` } : m)),
      );
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
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
    if (uiBundle) {
      const blob = new Blob([JSON.stringify(uiBundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}.ui-bundle.json`;
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

  const canDownload = !!(uiBundle || project?.preview_html);

  const updatePublishState = (patch: {
    isPublic?: boolean;
    publicSlug?: string | null;
    hasSnapshot?: boolean;
    publishedUrl?: string | null;
  }) => {
    setProject((prev) =>
      prev
        ? {
            ...prev,
            is_public: patch.isPublic ?? prev.is_public,
            public_slug: patch.publicSlug !== undefined ? patch.publicSlug : prev.public_slug,
            has_snapshot: patch.hasSnapshot ?? prev.has_snapshot,
            published_url:
              patch.publishedUrl !== undefined ? patch.publishedUrl : prev.published_url,
          }
        : prev,
    );
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
        {uiBundle ? (
          <div className="flex-1 min-h-0 flex flex-col p-2">
            <ClientSandpackPreview
              bundle={uiBundle}
              view={view === "preview" ? "preview" : "code"}
              readOnly={false}
              onSaveFiles={async (files) => {
                // Persist edited files back to the project's sandpack bundle.
                const nextBundle: UiBundle = {
                  routes: uiBundle.routes,
                  files,
                };
                const safeBundle = sanitizeUiBundle(nextBundle);
                const { error } = await supabase
                  .from("projects")
                  .update({
                    preview_sandpack: safeBundle as unknown as Json,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", projectId);
                if (error) {
                  toast.error("保存失败：" + error.message);
                  return;
                }
                setProject((p) =>
                  p ? { ...p, preview_sandpack: safeBundle as unknown as Json } : p,
                );
                toast.success("代码已保存");
              }}
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
                        .replace(/```(?:uibundle|lovable)[\s\S]*?```/gi, "✨ _已生成网页 — 见预览面板_")
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
            placeholder={sending ? "AI 正在运行，请稍候..." : "继续描述要修改什么..."}
            disabled={sending}
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
        <MobileGenerationHint />
        <ReferenceInputBar value={reference} onChange={setReference} disabled={sending} />
        <div className="px-2 pb-1">
          <StylePicker value={styleId} onChange={setStyleId} compact />
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
            <button
              type="button"
              onClick={() => setRenameOpen(true)}
              className="font-semibold truncate text-sm sm:text-base hover:text-brand transition text-left max-w-full"
              title="点击重命名"
            >
              {project.name}
            </button>
            <div className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">点击名称重命名</div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 ml-auto flex-wrap justify-end">
          <CreditBadge />
          {previewCodeToggle}
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="rounded-full glass px-3 py-1.5 text-xs hover:border-brand/40 transition flex items-center gap-1.5"
            title="发布到公网（国内可访问）"
          >
            <Share2 className="h-3 w-3" /> {project.is_public ? "已发布" : "发布"}
          </button>
          <button
            type="button"
            onClick={() => setPushOpen(true)}
            disabled={!uiBundle}
            className="rounded-full glass px-3 py-1.5 text-xs hover:border-brand/40 transition disabled:opacity-40 flex items-center gap-1.5"
            title="推送到 Gitee / GitHub"
          >
            <GitBranch className="h-3 w-3" /> 推送代码
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="rounded-full glass px-3 py-1.5 text-xs hover:border-brand/40 transition flex items-center gap-1.5"
            title="团队协作"
          >
            <Users className="h-3 w-3" /> 协作
          </button>
          <button
            type="button"
            onClick={() => setVersionsOpen(true)}
            disabled={!uiBundle}
            className="rounded-full glass px-3 py-1.5 text-xs hover:border-brand/40 transition disabled:opacity-40 flex items-center gap-1.5"
            title="版本历史"
          >
            <History className="h-3 w-3" /> 历史
          </button>
          {uiBundle && <ExportMenu bundle={uiBundle} projectName={project.name} />}
          <button
            type="button"
            onClick={() => setSchemaOpen(true)}
            className="rounded-full glass px-3 py-1.5 text-xs hover:border-brand/40 transition flex items-center gap-1.5"
            title="数据库表结构建议"
          >
            <Database className="h-3 w-3" /> Schema
          </button>
          <button
            type="button"
            onClick={download}
            disabled={!canDownload}
            className="rounded-full glass px-3 py-1.5 text-xs hover:border-brand/40 transition disabled:opacity-40 flex items-center gap-1.5"
          >
            <Download className="h-3 w-3" /> JSON
          </button>
        </div>

        <div className="flex lg:hidden items-center gap-1.5 ml-auto">
          {previewCodeToggle}
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="rounded-full glass px-2.5 py-1.5 text-[11px] flex items-center gap-1"
            title="发布"
          >
            <Share2 className="h-3 w-3" />
            <span className="hidden sm:inline">{project.is_public ? "已发布" : "发布"}</span>
          </button>
          <button
            type="button"
            onClick={() => setPushOpen(true)}
            disabled={!uiBundle}
            className="rounded-full glass px-2.5 py-1.5 text-[11px] disabled:opacity-40 flex items-center gap-1"
            title="推送到 Gitee / GitHub"
          >
            <GitBranch className="h-3 w-3" />
          </button>
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

      <RenameProjectDialog
        open={renameOpen}
        projectId={projectId}
        initialName={project.name}
        initialDescription={project.description}
        onClose={() => setRenameOpen(false)}
        onSaved={(next) =>
          setProject((p) => (p ? { ...p, name: next.name, description: next.description } : p))
        }
      />

      <PushToRepoDialog
        open={pushOpen}
        onOpenChange={setPushOpen}
        projectId={projectId}
        projectName={project.name}
        bundle={uiBundle}
        userId={session?.user.id ?? ""}
        onPulled={(bundle) => {
          setProject((p) =>
            p ? { ...p, preview_sandpack: bundle as unknown as Json, preview_html: null } : p,
          );
          toast.success("已从仓库拉取并合并");
        }}
      />

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        projectId={projectId}
        projectName={project.name}
        isPublic={project.is_public}
        publicSlug={project.public_slug}
        bundle={uiBundle}
        hasSnapshot={project.has_snapshot}
        publishedUrl={project.published_url}
        onChange={updatePublishState}
      />

      <VersionHistoryPanel
        projectId={projectId}
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        currentBundle={uiBundle}
        onRestored={(bundle) => {
          setProject((p) =>
            p ? { ...p, preview_sandpack: bundle as unknown as Json, preview_html: null } : p,
          );
        }}
      />

      <ShareTeamDialog open={shareOpen} onClose={() => setShareOpen(false)} projectId={projectId} />

      <SchemaHelperPanel
        open={schemaOpen}
        onClose={() => setSchemaOpen(false)}
        prompt={[...messages].reverse().find((m) => m.role === "user")?.content ?? input}
      />
    </div>
  );
}
