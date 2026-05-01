// Client-side helpers for pushing project code to Gitee / GitHub.
// Both APIs allow CORS from browsers when using a Personal Access Token.

import type { LovableBundle } from "./lovable-bundle";

export type Provider = "gitee" | "github";

export interface PushResult {
  repoUrl: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  filesPushed: number;
}

// Extract the actual user-authored files out of a LovableBundle.
// We exclude the synthetic /index.tsx wrapper (it's an internal sandpack entry).
export function bundleToFiles(bundle: LovableBundle): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, value] of Object.entries(bundle.files)) {
    if (path === "/index.tsx") continue;
    const code = value;
    // Strip leading slash for repo paths
    const repoPath = path.startsWith("/") ? path.slice(1) : path;
    out[repoPath] = code;
  }
  // Add a minimal package.json + README so the repo is usable
  if (!out["package.json"]) {
    out["package.json"] = JSON.stringify(
      {
        name: "lovable-export",
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1",
        },
        devDependencies: {
          "@vitejs/plugin-react": "^4.3.1",
          typescript: "^5.5.3",
          vite: "^5.4.1",
        },
      },
      null,
      2,
    );
  }
  if (!out["README.md"]) {
    out["README.md"] = "# Exported from Lovable Clone\n\nRun `npm install && npm run dev` to start.\n";
  }
  return out;
}

// =============== GITEE ===============
// Docs: https://gitee.com/api/v5/swagger
const GITEE_API = "https://gitee.com/api/v5";

async function giteeReq(token: string, path: string, init?: RequestInit) {
  const url = `${GITEE_API}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      ...(init?.headers || {}),
    },
  });
  return res;
}

export async function giteeGetUser(token: string): Promise<{ login: string }> {
  const res = await giteeReq(token, "/user");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gitee 认证失败 (${res.status}): ${t}`);
  }
  return res.json();
}

async function giteeRepoExists(token: string, owner: string, repo: string): Promise<boolean> {
  const res = await giteeReq(token, `/repos/${owner}/${repo}`);
  return res.ok;
}

async function giteeCreateRepo(token: string, name: string, isPrivate: boolean): Promise<void> {
  const res = await giteeReq(token, "/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: true, // create initial commit so we have a default branch
      description: "Pushed from Lovable Clone",
    }),
  });
  if (!res.ok && res.status !== 422) {
    // 422 = already exists; treat as ok
    const t = await res.text();
    throw new Error(`Gitee 创建仓库失败 (${res.status}): ${t}`);
  }
}

// Gitee: get a file's SHA if it exists (needed for update)
async function giteeGetFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<string | null> {
  const res = await giteeReq(
    token,
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha ?? null;
}

async function giteeUpsertFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  branch: string,
  message: string,
): Promise<void> {
  const sha = await giteeGetFileSha(token, owner, repo, path, branch);
  const body: Record<string, unknown> = {
    content: utf8ToBase64(content),
    message,
    branch,
  };
  if (sha) body.sha = sha;
  const method = sha ? "PUT" : "POST";
  const res = await giteeReq(token, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gitee 写入 ${path} 失败 (${res.status}): ${t}`);
  }
}

export async function pushToGitee(opts: {
  token: string;
  repoName: string;
  isPrivate: boolean;
  files: Record<string, string>;
  commitMessage: string;
}): Promise<PushResult> {
  const user = await giteeGetUser(opts.token);
  const owner = user.login;
  const exists = await giteeRepoExists(opts.token, owner, opts.repoName);
  if (!exists) await giteeCreateRepo(opts.token, opts.repoName, opts.isPrivate);

  const branch = "master"; // Gitee default with auto_init
  // Push files sequentially to avoid rate-limit / racing on same repo
  let count = 0;
  for (const [path, content] of Object.entries(opts.files)) {
    await giteeUpsertFile(opts.token, owner, opts.repoName, path, content, branch, opts.commitMessage);
    count++;
  }
  return {
    repoUrl: `https://gitee.com/${owner}/${opts.repoName}`,
    owner,
    repo: opts.repoName,
    defaultBranch: branch,
    filesPushed: count,
  };
}

// =============== GITHUB ===============
// Docs: https://docs.github.com/en/rest
const GITHUB_API = "https://api.github.com";

async function ghReq(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  return res;
}

export async function githubGetUser(token: string): Promise<{ login: string }> {
  const res = await ghReq(token, "/user");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub 认证失败 (${res.status}): ${t}`);
  }
  return res.json();
}

async function ghRepoExists(token: string, owner: string, repo: string): Promise<boolean> {
  const res = await ghReq(token, `/repos/${owner}/${repo}`);
  return res.ok;
}

async function ghCreateRepo(token: string, name: string, isPrivate: boolean): Promise<void> {
  const res = await ghReq(token, "/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: true,
      description: "Pushed from Lovable Clone",
    }),
  });
  if (!res.ok && res.status !== 422) {
    const t = await res.text();
    throw new Error(`GitHub 创建仓库失败 (${res.status}): ${t}`);
  }
}

async function ghGetFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<string | null> {
  const res = await ghReq(
    token,
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha ?? null;
}

async function ghUpsertFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  branch: string,
  message: string,
): Promise<void> {
  const sha = await ghGetFileSha(token, owner, repo, path, branch);
  const body: Record<string, unknown> = {
    message,
    content: utf8ToBase64(content),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await ghReq(token, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub 写入 ${path} 失败 (${res.status}): ${t}`);
  }
}

export async function pushToGithub(opts: {
  token: string;
  repoName: string;
  isPrivate: boolean;
  files: Record<string, string>;
  commitMessage: string;
}): Promise<PushResult> {
  const user = await githubGetUser(opts.token);
  const owner = user.login;
  const exists = await ghRepoExists(opts.token, owner, opts.repoName);
  if (!exists) await ghCreateRepo(opts.token, opts.repoName, opts.isPrivate);

  const branch = "main";
  let count = 0;
  for (const [path, content] of Object.entries(opts.files)) {
    await ghUpsertFile(opts.token, owner, opts.repoName, path, content, branch, opts.commitMessage);
    count++;
  }
  return {
    repoUrl: `https://github.com/${owner}/${opts.repoName}`,
    owner,
    repo: opts.repoName,
    defaultBranch: branch,
    filesPushed: count,
  };
}

// =============== utils ===============
function utf8ToBase64(s: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(s, "utf-8").toString("base64");
  }
  // btoa needs Latin-1; encode utf-8 first
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
