import { useEffect, useState } from "react";
import { Loader2, ExternalLink, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  bundleToFiles,
  giteeGetUser,
  githubGetUser,
  pushToGitee,
  pushToGithub,
  type Provider,
} from "@/lib/code-hosting";
import type { UiBundle } from "@/lib/ui-bundle";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  bundle: UiBundle | null;
  userId: string;
}

interface IntegrationRow {
  provider: Provider;
  access_token: string;
  username: string | null;
}

interface RepoRow {
  provider: Provider;
  repo_owner: string;
  repo_name: string;
  repo_url: string;
  default_branch: string;
}

const TOKEN_HELP: Record<Provider, { url: string; label: string; scopes: string }> = {
  gitee: {
    url: "https://gitee.com/profile/personal_access_tokens/new",
    label: "Gitee 私人令牌",
    scopes: "勾选 projects、user_info 权限",
  },
  github: {
    url: "https://github.com/settings/tokens/new?scopes=repo&description=TensorView",
    label: "GitHub Personal Access Token",
    scopes: "勾选 repo 权限（classic token）",
  },
};

function sanitizeRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "tensorview-project";
}

export function PushToRepoDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  bundle,
  userId,
}: Props) {
  const [provider, setProvider] = useState<Provider>("gitee");
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [savedTokens, setSavedTokens] = useState<Record<Provider, IntegrationRow | null>>({
    gitee: null,
    github: null,
  });
  const [savedRepos, setSavedRepos] = useState<Record<Provider, RepoRow | null>>({
    gitee: null,
    github: null,
  });
  const [repoName, setRepoName] = useState(sanitizeRepoName(projectName));
  const [isPrivate, setIsPrivate] = useState(false);
  const [commitMsg, setCommitMsg] = useState("Update from TensorView");
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [lastResult, setLastResult] = useState<{ url: string; count: number } | null>(null);

  // Load existing tokens + repo mapping
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [intRes, repoRes] = await Promise.all([
          supabase
            .from("user_integrations")
            .select("provider, access_token, username")
            .eq("user_id", userId),
          supabase
            .from("project_repos")
            .select("provider, repo_owner, repo_name, repo_url, default_branch")
            .eq("project_id", projectId),
        ]);
        if (cancelled) return;
        const tokens: Record<Provider, IntegrationRow | null> = { gitee: null, github: null };
        for (const row of intRes.data ?? []) {
          tokens[row.provider as Provider] = row as IntegrationRow;
        }
        const repos: Record<Provider, RepoRow | null> = { gitee: null, github: null };
        for (const row of repoRes.data ?? []) {
          repos[row.provider as Provider] = row as RepoRow;
        }
        setSavedTokens(tokens);
        setSavedRepos(repos);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId, projectId]);

  // Sync UI when provider changes
  useEffect(() => {
    const t = savedTokens[provider];
    setHasToken(!!t);
    setToken("");
    const r = savedRepos[provider];
    if (r) {
      setRepoName(r.repo_name);
    } else {
      setRepoName(sanitizeRepoName(projectName));
    }
    setLastResult(null);
  }, [provider, savedTokens, savedRepos, projectName]);

  const saveToken = async () => {
    if (!token.trim()) {
      toast.error("请输入 token");
      return;
    }
    setLoading(true);
    try {
      // Verify token by hitting the user endpoint
      const user =
        provider === "gitee"
          ? await giteeGetUser(token.trim())
          : await githubGetUser(token.trim());
      const { error } = await supabase.from("user_integrations").upsert(
        {
          user_id: userId,
          provider,
          access_token: token.trim(),
          username: user.login,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );
      if (error) throw error;
      setSavedTokens((prev) => ({
        ...prev,
        [provider]: { provider, access_token: token.trim(), username: user.login },
      }));
      setHasToken(true);
      setToken("");
      toast.success(`已绑定 ${user.login}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "绑定失败");
    } finally {
      setLoading(false);
    }
  };

  const removeToken = async () => {
    setLoading(true);
    try {
      await supabase
        .from("user_integrations")
        .delete()
        .eq("user_id", userId)
        .eq("provider", provider);
      setSavedTokens((prev) => ({ ...prev, [provider]: null }));
      setHasToken(false);
      toast.success("已解绑");
    } finally {
      setLoading(false);
    }
  };

  const doPush = async () => {
    if (!bundle) {
      toast.error("当前项目没有可推送的代码");
      return;
    }
    const tokenRow = savedTokens[provider];
    if (!tokenRow) {
      toast.error("请先绑定 token");
      return;
    }
    const cleanRepo = sanitizeRepoName(repoName);
    if (!cleanRepo) {
      toast.error("仓库名无效");
      return;
    }
    setPushing(true);
    try {
      const files = bundleToFiles(bundle);
      const fn = provider === "gitee" ? pushToGitee : pushToGithub;
      const result = await fn({
        token: tokenRow.access_token,
        repoName: cleanRepo,
        isPrivate,
        files,
        commitMessage: commitMsg || "Update from TensorView",
      });
      // Persist mapping
      await supabase.from("project_repos").upsert(
        {
          project_id: projectId,
          user_id: userId,
          provider,
          repo_owner: result.owner,
          repo_name: result.repo,
          repo_url: result.repoUrl,
          default_branch: result.defaultBranch,
          last_pushed_at: new Date().toISOString(),
        },
        { onConflict: "project_id,provider" },
      );
      setSavedRepos((prev) => ({
        ...prev,
        [provider]: {
          provider,
          repo_owner: result.owner,
          repo_name: result.repo,
          repo_url: result.repoUrl,
          default_branch: result.defaultBranch,
        },
      }));
      setLastResult({ url: result.repoUrl, count: result.filesPushed });
      toast.success(`已推送 ${result.filesPushed} 个文件`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "推送失败");
    } finally {
      setPushing(false);
    }
  };

  if (!open) return null;
  const help = TOKEN_HELP[provider];
  const savedRepo = savedRepos[provider];
  const savedToken = savedTokens[provider];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !pushing && onOpenChange(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-semibold">推送到代码托管</h3>
        </div>

        {/* Provider tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl bg-muted/50">
          {(["gitee", "github"] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                provider === p ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "gitee" ? "Gitee（国内）" : "GitHub"}
              {savedTokens[p] && <span className="ml-1.5 text-[10px] text-brand">●</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-6 grid place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasToken ? (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground leading-relaxed">
              请先绑定 {help.label}。
              <a
                href={help.url}
                target="_blank"
                rel="noreferrer"
                className="ml-1 text-brand hover:underline inline-flex items-center gap-0.5"
              >
                生成 token <ExternalLink className="h-3 w-3" />
              </a>
              <div className="mt-1 text-[11px]">{help.scopes}</div>
            </div>
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="粘贴你的 token"
              className="w-full rounded-lg bg-input border border-border px-3 py-2 text-xs outline-none focus:border-brand"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-full glass px-3 py-2 text-xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveToken}
                disabled={loading || !token.trim()}
                className="flex-1 rounded-full btn-brand px-3 py-2 text-xs disabled:opacity-50"
              >
                绑定
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs flex items-center justify-between">
              <span className="text-muted-foreground">
                已登录: <span className="text-foreground font-medium">{savedToken?.username}</span>
              </span>
              <button
                type="button"
                onClick={removeToken}
                className="text-muted-foreground hover:text-destructive"
              >
                解绑
              </button>
            </div>

            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">仓库名</label>
              <input
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                disabled={!!savedRepo}
                className="w-full rounded-lg bg-input border border-border px-3 py-2 text-xs outline-none focus:border-brand disabled:opacity-60"
              />
              {savedRepo && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  已绑定到{" "}
                  <a
                    href={savedRepo.repo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  >
                    {savedRepo.repo_owner}/{savedRepo.repo_name}
                  </a>
                </p>
              )}
            </div>

            {!savedRepo && (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="rounded"
                />
                <span>创建为私有仓库</span>
              </label>
            )}

            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">提交信息</label>
              <input
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                className="w-full rounded-lg bg-input border border-border px-3 py-2 text-xs outline-none focus:border-brand"
              />
            </div>

            {lastResult && (
              <div className="rounded-lg border border-brand/30 bg-brand/5 p-2.5 text-xs">
                ✓ 已推送 {lastResult.count} 个文件 ·{" "}
                <a
                  href={lastResult.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline inline-flex items-center gap-0.5"
                >
                  查看仓库 <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={pushing}
                className="flex-1 rounded-full glass px-3 py-2 text-xs"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={doPush}
                disabled={pushing || !bundle}
                className="flex-1 rounded-full btn-brand px-3 py-2 text-xs disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {pushing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> 推送中…
                  </>
                ) : savedRepo ? (
                  "推送更新"
                ) : (
                  "创建并推送"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
