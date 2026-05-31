## 目标

把英文版做成"真·英文版"，而不是翻译稿：

1. **英文文案按 SEO 重写**（针对 Google 搜索习惯），不是从中文逐字翻译
2. **所有页面（不只是首页）切换语言时全部变英文**
3. **按 IP 自动切换**：中国大陆 IP → 默认中文；其他地区 → 默认英文（用户手动切换后以用户选择为准）

---

## 1. 英文文案重写（SEO-aware，非翻译）

不做"中→英"的字面翻译。所有英文 copy 围绕目标关键词重写，按英文用户搜索习惯组织。

**目标关键词方向（首页/Meta）：**
- 主关键词：`ai website builder`, `text to website`, `build website with ai`, `ai web app generator`
- 长尾：`generate website from prompt`, `no-code ai app builder`
- 中文版关键词不动：`AI 建站`、`一句话生成网站`、`AI 网页生成`

**英文 copy 风格：**
- Hero 标题用动词开头 + 价值主张（如 "Build production websites from a single prompt"），不是中文"用一句话生成你的网站"的直译
- Subtitle 强调 outcome + no-code + speed
- Features 用英文 SaaS 落地页通行的短动词卡片（"Ship in minutes", "Iterate by chatting"）
- FAQ 题目按 Google "People also ask" 风格写（"How does an AI website builder work?" 等），利于 Featured Snippet
- Meta title ≤60 字符，含主关键词 + 品牌；meta description ≤160 字符，含 CTA

**Meta / SEO 处理：**
- 每个路由的 `head()` 根据当前 `lang` 输出不同 `<title>` / `<meta description>` / `og:title` / `og:description`
- 加 `<link rel="alternate" hreflang="zh-CN" href=".../zh">` 与 `hreflang="en"`、`hreflang="x-default"`，告诉 Google 这是两种语言版本
- `<html lang>` 跟随当前语言（已实现）
- sitemap.xml 为每个公开页加上 zh / en 两条 `<xhtml:link rel="alternate">`，让 Google Search Console 正确索引

---

## 2. 全站翻译覆盖

当前只有首页 + Header/Footer + Settings 用了 i18n。把字典扩展到所有用户可见页面：

**需要补 i18n 的页面：**
- `auth.tsx`（登录/注册/找回密码表单 + 校验提示）
- `forgot-password.tsx`、`reset-password.tsx`
- `pricing.tsx`（套餐名、bullet、按钮、FAQ）
- `docs.tsx` + `docs.$slug.tsx`（列表标题、空状态、文章 meta；正文文章本身按下方策略处理）
- `dashboard.tsx`（项目卡片、空状态、操作按钮、确认弹窗）
- `project.$projectId.tsx`（输入区提示、Toast、Tab、生成状态文案）
- `settings.tsx` 其它分区（账户、邮箱、信用、订单）
- `p.$projectId.tsx`、`s.$slug.tsx`（公开预览页页眉、CTA）
- `unsubscribe.tsx`
- Admin 页面（`_admin.*`）：仅管理员可见，**不翻译**，保持中文以降低工作量（除非你想翻）
- 各 `components/*.tsx` 里硬编码的中文（Dialog 标题、按钮、Toast）：`PublishDialog`、`PushToRepoDialog`、`RenameProjectDialog`、`CreditsPanel`、`FeedbackButton`、`CreditBadge`、`MobileWarningBanner`（已做）、`PublicProjectView` 等
- Toast 文案（`sonner`）：统一走 `t()`

**文档正文（`src/content/docs-articles.ts`）：**
- 文档内容较长，逐篇人工译成英文成本高。方案：字典里加 `articles.{slug}.title / description / body`，英文版用单独写的英文版本（不是翻译，是面向英文开发者重写，标题命中英文搜索词如 "How to deploy a website from a prompt"）。
- 短期可以先只翻 docs 列表页 + 文章 meta（title/description），文章正文未翻时英文用户看到中文正文 + 顶部一条提示 "English version coming soon"。最终目标是全部重写。

**字典文件拆分：**
- `i18n-dict.ts` 单文件会膨胀到几千行。按模块拆：`i18n/common.ts`、`i18n/landing.ts`、`i18n/auth.ts`、`i18n/pricing.ts`、`i18n/docs.ts`、`i18n/dashboard.ts`、`i18n/project.ts`、`i18n/settings.ts`，再在 `i18n-dict.ts` 合并。

**翻译工作量提示：**
全站重写英文文案是个不小的工作量（估算 600–1000 条 key）。本次先完成结构（拆字典 + 所有页面接入 `useT()` + key 覆盖），英文文案我会按 SEO 风格新写而不是机器翻译；如果某些次要文案你想之后再打磨，会标 TODO。

---

## 3. 按 IP 自动语言

**判定逻辑（仅首次访问生效）：**
1. 如果 `localStorage["tv.lang"]` 已有值 → 用用户选择，**不覆盖**
2. 否则按 IP 国家判定：`CN` / `HK`(可选) / `MO`(可选) / `TW`(可选) → `zh`，其它 → `en`
   - 建议：仅 `CN` → `zh`；`HK/TW/MO` 用户多数能读繁/英，默认英文更安全。最终听你的，下面问题里会问
3. IP 取不到时 → 看 `navigator.language` 是否 `zh*`，否则 `en`

**实现方式（关键，不能放客户端）：**
客户端拿不到 IP 国家。两种方案：

- **方案 A（推荐）：SSR 期间在 `__root.tsx` 的 `beforeLoad` 里读请求头**
  - Cloudflare Workers 自动注入 `CF-IPCountry` header
  - 在 root route 用 `getRequestHeaders()`（TanStack Start 的 server util）读 `cf-ipcountry`
  - 通过 `loaderData` 把 `initialLang` 传给 `LanguageProvider`
  - 同时写入一个 `tv.lang.auto` cookie，避免每次 SSR 重判
  - SEO 友好：Googlebot（多数从美国 IP 爬）拿到的 HTML 就是英文版，对英文 SEO 关键

- **方案 B：客户端调一个轻量 `/api/geo` 路由**
  - 该路由用 `cf-ipcountry` 返回国家码
  - 首屏会先渲染默认语言再 flicker 一下切换，体验差，**SEO 也差**（Googlebot 拿到的是默认中文）
  - 不推荐，但实现快

→ 选方案 A。

**i18n Provider 改造：**
- `LanguageProvider` 接受 `initialLang` prop（来自 SSR）
- `detectInitial()` 优先级：`localStorage` → `initialLang`（SSR 注入）→ `navigator.language` → `"en"`
- 用户在 Header / Settings 切换后写 `localStorage`，永久覆盖 IP 判定

---

## 4. 文件改动清单

**新建：**
- `src/lib/i18n/common.ts`、`landing.ts`、`auth.ts`、`pricing.ts`、`docs.ts`、`dashboard.ts`、`project.ts`、`settings.ts`（拆分字典）
- `src/lib/geo.ts`：服务端读 `cf-ipcountry` 的工具

**修改：**
- `src/lib/i18n-dict.ts`：改为聚合各模块
- `src/lib/i18n.tsx`：接受 SSR `initialLang`
- `src/routes/__root.tsx`：`beforeLoad` 读国家码，注入到 `LanguageProvider`；增加 `hreflang` link
- `src/routes/sitemap[.]xml.ts`：每条 URL 加 `xhtml:link alternate` 两条（zh / en）
- 上面"需要补 i18n 的页面"列表里的所有 route 与 component：把硬编码中文替换为 `t("...")`，并在每个 route 的 `head()` 内按 `lang` 输出对应 title / description / og

**不动：**
- Admin 页面、邮件模板正文、AI 系统 prompt（这些是后端/管理向，不影响最终用户的语言体验）

---

## 5. 风险 / 注意

- TanStack Start 的 `head()` 是在 SSR 期产生 HTML 的，需要在 `head()` 里能拿到 `lang`：通过 root `loader` 把 `lang` 放进 `context` / `loaderData`，子路由的 `head()` 通过 `loaderData`（或 `useRouteContext`）拿
- SSR 注入 lang 后客户端 hydrate 不能再"瞬时"切到另一个语言，否则会闪烁。`LanguageProvider` 首屏严格使用 SSR 的 `initialLang`
- Googlebot 主要从美国 IP 抓 → SSR 默认 en 是对的；中国境内用户首屏 zh，也对
- `hreflang` 必须两边互相指向，并加 `x-default`

---

## 需要你确认的两点

1. **港澳台默认语言**：CN 走中文是确定的。HK / TW / MO 你想默认中文还是英文？我个人建议英文（这些地区繁体多、英文好，且我们字典是简体），但你说了算。
2. **docs 文章正文翻译策略**：A) 本轮只翻 docs 列表 + 文章 meta，正文先保持中文 + 顶部"English version coming"提示；B) 本轮把每篇文章正文也用 SEO 风格英文重写（工作量较大、本轮 token 占用高）。建议 A，下一轮专门做 B。
