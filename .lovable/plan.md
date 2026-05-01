## 现状

你的 publish 功能 **已经存在并且国内可访问**：

- 用户在编辑器里把 `is_public` 切成开，就生成一个公开链接 `/p/:projectId`
- 公开链接由路由 `src/routes/p.$projectId.tsx` 渲染，跑在你自己的网站上（`fliggy-clone-inspired.lovable.app` / 你绑定的域名），**不依赖 vercel，国内可直连**
- 数据从 Supabase 读 `preview_html` / `preview_sandpack`，Sandpack 在浏览器里跑

所以"国内访问不了"这个担心目前不存在。**问题是另外两个**：

1. `/p/:projectId` 的链接是带 UUID 的丑链接，没有"独立可分享"的感觉，也无法绑定自定义子域名
2. 用户拿到 URL 后**没有"国内 CDN 加速"**，Sandpack 用的 `@codesandbox/sandpack-react` 默认从 `https://*.codesandbox.io` 拉打包器 bundler iframe — 这一步在国内**不稳定**（这才是真正会被墙/被慢的点）

---

## 方案

### 1. 短链 + 自定义 slug（让 publish 链接像 lovable 一样体面）

- `projects` 表加一列 `public_slug TEXT UNIQUE`，开启 publish 时自动生成 6 位 slug
- 新路由 `src/routes/s.$slug.tsx`，按 slug 查项目
- publish dialog 里把链接显示成 `https://你的域名/s/abc123`，并允许用户改 slug
- 老的 `/p/:projectId` 保留兼容

### 2. 国内可访问的 Sandpack（关键改动）

Sandpack 默认 bundler URL 是国外的，**这是国内打不开 publish 页的真正原因**。两条路任选：

- **A 方案（推荐，零成本）**：给 `<SandpackProvider>` 传 `bundlerURL` 指向**自托管 bundler**。最简单是用 codesandbox 的 sandpack-bundler 部署到 Cloudflare Pages 的 `*.pages.dev`（国内通），或者 Netlify、或者你自己的 lovable 域名子路径。我们会在代码里做成可配的环境变量 `VITE_SANDPACK_BUNDLER_URL`，留空就走默认。
- **B 方案（更彻底）**：publish 的时候把 sandpack bundle **预编译成静态 HTML+JS**（用 esbuild-wasm 在浏览器里打包，或在 server function 里用 esbuild），存到 `preview_html`，公开页直接 iframe srcDoc 渲染，**完全不依赖 sandpack 在线 bundler**。代价是每次 publish 多一步编译。

我建议两个都做：默认 A（无感、即时），用户点"发布稳定版"按钮时走 B（生成快照）。

### 3. 自定义子域名 / 自定义域名（可选，做不做你定）

- 给 publish 出来的页加自定义域名，得有 wildcard DNS + 反向代理，**这一块依赖你的部署环境**（lovable.app 子域不能你自己控制）。本轮不做，先把 1+2 跑通。

---

## 技术实现清单

**数据库迁移**
- `projects` 加 `public_slug TEXT UNIQUE`
- 加函数 `generate_public_slug()` 生成 6 位随机 slug
- RLS：允许任何人 `select` 当 `is_public = true`（已有策略检查一下）

**前端**
- 新路由 `src/routes/s.$slug.tsx`，复用 `p.$projectId.tsx` 的渲染逻辑（抽成 `<PublicProjectView>` 组件）
- 编辑器 publish 区块：显示 `/s/{slug}` 链接 + "复制" + "改 slug" 输入框
- `LovableSandpack.tsx` 读取 `import.meta.env.VITE_SANDPACK_BUNDLER_URL`，传给 `SandpackProvider` 的 `options.bundlerURL`
- 新 server function `publishSnapshot(projectId)`：用 esbuild-wasm 把 bundle 打成单文件 HTML，写回 `preview_html`，公开页优先用 snapshot，没 snapshot 就 fallback 到 sandpack

**新组件 / 文件**
- `src/components/PublicProjectView.tsx`（抽出来复用）
- `src/routes/s.$slug.tsx`
- `src/lib/publish-snapshot.ts`（esbuild-wasm 打包逻辑）
- `src/fn/publish-snapshot.ts`（server function 入口，可选，先做客户端版）

**用户文案**
- publish 面板里加一行说明："国内访问已优化，使用稳定快照模式"

---

## 需要你确认 1 件事

Sandpack bundler 自托管这块，我**默认先用 A 方案**（环境变量留空 = 用默认；你后面想加速，自己部署一个 bundler 把 URL 填进 `.env` 就行），同时把 B 方案（esbuild-wasm 预编译快照）也做出来作为默认 publish 行为。

**这样组合后**：
- 编辑器里实时预览 = sandpack 在线 bundler（开发体验好）
- publish 出去给别人看的链接 = 预编译快照 HTML（国内秒开，不依赖任何外网）

如果同意，我就按这个走。