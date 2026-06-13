// 文档教程文章数据。新增文章只需在此追加一项即可，sitemap 和 /docs 列表会自动同步。

export interface DocArticle {
  slug: string;
  title: string;
  description: string;
  keywords: string;
  datePublished: string;
  dateModified: string;
  readMinutes: number;
  /** Markdown-ish 内容：支持 # / ## / ### 标题、空行段落、- 列表、```代码块```、**加粗**、`行内代码` */
  body: string;
}

export const DOC_ARTICLES: DocArticle[] = [
  {
    slug: "build-landing-page-with-ai-in-5-minutes",
    title: "How to Build a Landing Page with AI in 5 Minutes（用 AI 在 5 分钟内构建落地页）",
    description:
      "Step-by-step guide to building a high-converting landing page with TensorView AI in under 5 minutes. AI landing page builder, quick web design AI.",
    keywords: "AI landing page builder, quick web design AI, AI 建站, 落地页生成",
    datePublished: "2026-05-22",
    dateModified: "2026-05-27",
    readMinutes: 5,
    body: `# 用 AI 在 5 分钟内构建一个落地页

想用 AI 快速搭一个能跑、能转化的落地页（landing page）？这篇教程会带你用 **TensorView AI** 从零到上线，全过程不到 5 分钟。

## 为什么选择 AI landing page builder

传统做一个落地页通常要：设计稿 → 切图 → 写 HTML/CSS → 调响应式 → 部署。一个人做下来一两天起步。AI landing page builder 把这套流程压缩到一句话：你描述想要什么，AI 直接生成可运行的代码。

TensorView AI 的特点：

- 一句话生成完整页面（含响应式、动效、SEO meta）
- 实时预览，对话式持续优化
- 一键发布到自定义域名
- 内置 Supabase（数据库 + 鉴权），不用自己搭后端

## 第 1 步：登录并新建项目

打开 [ai.tensorview.cc](https://ai.tensorview.cc/)，点击右上角「免费开始」注册账户。进入 Dashboard 后点击「新建项目」。

## 第 2 步：用一句话描述你想要的落地页

把你的产品/服务用一两句话讲清楚，越具体越好。示例 prompt：

\`\`\`
为一款叫 NoteFlow 的 AI 笔记 SaaS 做落地页：
深色主题、紫色渐变、英雄区有一段动效标题和 CTA 按钮，
中间放 3 个核心功能卡片，最后是定价表和 FAQ。
\`\`\`

AI 会在几秒钟内生成完整的 React 页面，包含 Hero、Features、Pricing、FAQ 四个区块。

## 第 3 步：用对话持续优化

不满意？直接在左侧聊天框告诉 AI：

- “Hero 标题改成 'Think faster. Write better.'”
- “把定价从 3 档改成 2 档，去掉企业版”
- “FAQ 加一题：是否支持中文？”

AI 会在已有版本上做最小改动，不会把你之前调好的东西推翻重做。

## 第 4 步：绑定自定义域名 & 发布

点击右上角「发布」，获得 EdgeOne 或 Vercel 独立域名；也可在「设置 → 自定义域名」绑定你的域名，CNAME 解析到平台提供的地址即可，会自动签 HTTPS 证书。

## 5 分钟之后你得到了什么

- 一个上线的、自带 HTTPS 的响应式落地页
- 完整源码（随时可下载）
- 内置 SEO meta、Open Graph、JSON-LD
- 后续随时用对话迭代

## 下一步

- 想接入表单收集 leads？看 [Deploying Your First App on TensorView AI](/docs/deploying-your-first-app-on-tensorview-ai)
- 想绑定自己的域名？看 [Connecting Your Custom Domain](/docs/connecting-your-custom-domain-with-tensorview-ai)

准备好了？[现在就开始构建](/auth?mode=signup)。`,
  },
  {
    slug: "deploying-your-first-app-on-tensorview-ai",
    title: "Deploying Your First App on TensorView AI: A Step-by-Step Guide",
    description:
      "Complete walkthrough for deploying your first AI-generated web app on TensorView AI. Deploy web app AI, instant web hosting, zero-config publishing.",
    keywords: "Deploy web app AI, instant web hosting, AI 部署, TensorView 教程",
    datePublished: "2026-05-23",
    dateModified: "2026-05-27",
    readMinutes: 6,
    body: `# 在 TensorView AI 上部署你的第一个应用

这篇教程会一步步带你把一个 AI 生成的 Web App 部署到生产环境，并解释 instant web hosting 背后到底发生了什么。

## 部署之前：你需要什么

- 一个 TensorView AI 账户（[免费注册](/auth?mode=signup)）
- 一个已经生成的项目（如果还没有，先看 [How to Build a Landing Page with AI in 5 Minutes](/docs/build-landing-page-with-ai-in-5-minutes)）

不需要：服务器、Docker、CI/CD、Nginx 配置。

## 第 1 步：在编辑器中确认预览没问题

打开你的项目，右侧是实时预览。先把要发布的功能在预览里点一遍：

- 表单提交是否成功？
- 路由跳转是否正常？
- 移动端是否自适应？

发现问题就在左侧对话里告诉 AI 修，比如：「移动端 hero 区按钮被遮挡了，帮我调一下间距」。

## 第 2 步：点击「发布」

顶栏右上角的「发布」按钮就是 deploy web app AI 的入口。点击后平台会：

1. 把当前版本编译成生产构建（production build）
2. 把静态资源推送到全球 CDN
3. 给你一个公开分享链接（如 \`https://ai.tensorview.cc/s/your-slug\`）
4. 自动签发并配置 HTTPS

整个过程通常在 30 秒内完成。这就是所谓的 **instant web hosting**——你不用关心机器在哪、跑在什么进程上。

## 第 3 步：测试发布版本

发布后会出现一个公开 URL，比如 \`https://ai.tensorview.cc/s/your-slug\`。在隐身窗口里打开它，确认：

- 页面能正常加载
- API 调用走的是生产环境
- 数据库读写权限正确（RLS 策略生效）

## 第 4 步：迭代不影响线上

之后你继续在编辑器里改，**线上不会自动更新**。每次想发新版本，再点一次「发布」即可。这种「预览 vs 发布」分离让你可以放心试错。

## 常见问题

### 部署失败了怎么办？

打开浏览器 DevTools 看 Console 错误，最常见的是：

- 引用了不存在的环境变量 → 去「设置 → Secrets」补上
- 数据库迁移没跑 → 在编辑器里跟 AI 说「帮我创建 xxx 表」

### 我可以回滚到旧版本吗？

可以。项目「历史」面板里每次发布都有快照，一键回滚。

### 流量大了会扛不住吗？

底层是 Cloudflare Workers + CDN，水平扩展是自动的。你只需要关注业务，不用关心运维。

## 下一步

部署完成后，绑定一个你自己的域名能让品牌看起来更专业：[Connecting Your Custom Domain with TensorView AI](/docs/connecting-your-custom-domain-with-tensorview-ai)。`,
  },
  {
    slug: "connecting-your-custom-domain-with-tensorview-ai",
    title: "Connecting Your Custom Domain with TensorView AI（绑定自定义域名）",
    description:
      "How to connect a custom domain to your TensorView AI project: DNS, CNAME, HTTPS, and troubleshooting. AI web builder custom domain setup made simple.",
    keywords: "AI web builder custom domain setup, 自定义域名, CNAME, HTTPS",
    datePublished: "2026-05-24",
    dateModified: "2026-05-27",
    readMinutes: 4,
    body: `# 在 TensorView AI 上绑定自定义域名

临时分享链接能跑通，但要做正经品牌，得绑你自己的域名（比如 \`yourbrand.com\`）。这篇是最完整的 AI web builder custom domain setup 指南。

## 准备工作

- 一个已经发布的项目（有公开分享链接）
- 一个你拥有的域名（在 Namecheap / Cloudflare / 阿里云 / GoDaddy 等任意域名商购买的都行）
- 该域名的 DNS 管理权限

## 第 1 步：在 TensorView 添加域名

打开你的项目 → 「设置」→ 「自定义域名」→ 输入你要绑定的域名，例如 \`app.yourbrand.com\`。

平台会立即给你一段 DNS 记录，通常是一条 **CNAME**：

\`\`\`
类型: CNAME
主机: app
值:   <平台给你的目标地址>
TTL:  自动 / 600
\`\`\`

## 第 2 步：到域名商配置 DNS

以 Cloudflare 为例：

1. 进入你的域名 → DNS → Records
2. 点 "Add record"
3. Type 选 **CNAME**，Name 填 \`app\`，Target 粘平台给你的值
4. **代理状态（小云朵）务必关掉（DNS only / 灰色）**，否则会和我们自己的 CDN 打架，可能出现 \`error code: 1010\` 或证书循环

阿里云 / GoDaddy / Namecheap 同理，找到 DNS 管理面板加 CNAME 即可。

## 第 3 步：等待 DNS 生效

DNS 生效通常 1 分钟到 30 分钟。可以用 \`dig\` 检查：

\`\`\`bash
dig app.yourbrand.com CNAME +short
\`\`\`

输出里能看到平台给你的目标地址就说明生效了。

## 第 4 步：HTTPS 自动签发

DNS 生效后，TensorView 会自动通过 Let's Encrypt 签发证书。一般在 1～2 分钟内完成。完成后状态会从 "Pending" 变成 "Active"。

之后你的应用就能通过 \`https://app.yourbrand.com\` 访问，且证书会自动续期，不用管。

## 想用根域名（不带 www）？

根域名（apex domain，比如 \`yourbrand.com\` 没有前缀）不能用 CNAME，要用 **A 记录** 或者支持 CNAME flattening 的 DNS（Cloudflare 默认支持，可以直接对根域名加 CNAME）。

在 TensorView 添加 \`yourbrand.com\` 时，界面会告诉你具体填什么。

## 常见问题排查

### 浏览器显示 "证书无效"

通常是证书还在签发中，等 2-3 分钟刷新。如果超过 10 分钟仍未生效，检查 DNS 是否指向了**正确的**目标地址（最常见的错误是粘错了一两个字符）。

### 出现 Cloudflare \`error code: 1010\`

你在自己的 Cloudflare 上把这条 CNAME 的「代理状态」开成了橙色小云朵。改成「DNS only」（灰色）就好。

### 站点地图 / robots.txt 提交后 GSC 报无法抓取

确保你提交的是绑定后的域名（\`https://app.yourbrand.com/sitemap.xml\`），且 DNS 那条 CNAME 是 DNS only 模式。如果走了第三方代理的橙色小云朵，Googlebot 经常会被挡。

## 下一步

- 想给不同环境用不同子域名？再加一条 CNAME 指向另一个项目即可。
- 想跑 SEO？看 [How to Build a Landing Page with AI in 5 Minutes](/docs/build-landing-page-with-ai-in-5-minutes) 里关于 meta 和 JSON-LD 的内容。`,
  },
];

export function getArticle(slug: string): DocArticle | undefined {
  return DOC_ARTICLES.find((a) => a.slug === slug);
}
