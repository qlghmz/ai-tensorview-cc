# 改动计划

## 1. 手机端提示横幅（要做）

**位置**：全站 `src/routes/__root.tsx` 顶部 + 项目生成页 `project.$projectId.tsx` 输入框上方各加一处。

- 用现有 `useIsMobile()` 钩子检测视口 `<768px`。
- 顶部一条可关闭的黄色横幅（`bg-yellow-50 dark:bg-yellow-900/30`，左侧 `AlertTriangle` 图标），文案：
  - 中文：「📱 手机端预览较慢（2–5 分钟），推荐使用电脑端获得最佳体验。」
  - 英文：「📱 Mobile preview is slow (2–5 min). Use desktop for the best experience.」
- 关闭状态写入 `localStorage`（`tv.mobile-warn.dismissed`），24 小时后再次出现。
- 项目生成页里，输入框正下方加一句小字提示（不可关闭，仅手机端显示）。

## 2. 中英文双语切换（要做）

目前站点是中文硬编码。要做一个轻量级 i18n，不引入重型库（`react-i18next` 太重，会拖慢首屏）。

### 方案
- 新增 `src/lib/i18n.tsx`：
  - `type Lang = "zh" | "en"`
  - `LanguageProvider` + `useT()` Hook
  - 语言保存到 `localStorage("tv.lang")`，默认根据 `navigator.language` 推断
  - 翻译表用普通 TS 对象 `dict.ts`，按 `key.path` 取值
- 在 `__root.tsx` 用 `<LanguageProvider>` 包住整个应用
- 顶部 `SiteHeader.tsx`：右上角放一个**显眼**的 `中文 / EN` 切换胶囊按钮（不藏在下拉里），样式参考 GitHub 的 dark/light toggle
- `settings.tsx`：新增「语言 / Language」一节，单选 `中文 / English`，与 header 同步
- 同步更新 HTML `<html lang>` 属性（影响 SEO）

### 翻译范围（首期）
- SiteHeader / SiteFooter（导航、CTA、版权）
- 首页 `index.tsx`（hero、suggestions、特性卡、CTA）
- 设置页 `settings.tsx`
- 手机端横幅文案
- 项目生成页主要按钮和提示（"生成中"、"发布"、"重命名"等）

**不做**（数据量太大，留后续）：Docs 文章正文、邮件模板、AI 系统提示（保持中文不变，生成出来的网站语言由用户提示词决定）。

## 3. Lovable 对比分析（仅说明，不写代码）

写在响应里，不写代码。会从以下角度对比：
- 生成质量（黑白骨架问题的根因 + 解决方向）
- Plan / 需求澄清流程（Lovable 怎么做、我们怎么补）
- 多文件项目结构、设计系统、组件丰富度
- 速度、流式体验
- 编辑能力（精确改某个组件 vs 全量重写）
- 部署、自定义域名、协作

## 4. 后端生成能力规划（仅规划，不实现）

写一份「能不能做、怎么做、分几期」的路线图。要点：
- 当前是 Sandpack 前端预览，跑不了 Node 后端
- 三种可行方案对比：
  - **A. WebContainers**（StackBlitz）：浏览器里跑 Node，能跑 Express，但带宽和兼容性受限
  - **B. 共享后端 = 当前项目的 Supabase**：让 AI 生成的代码直接调用 `supabase` client，自动建表 + RLS，**最贴合 Lovable 的玩法**，推荐
  - **C. 给每个生成项目独立 Supabase**：要 Supabase Management API，成本高
- 推荐方案 B 的分期：
  1. 让 AI 输出 SQL migration → 后端自动执行到一个隔离 schema
  2. 扩展系统提示，告诉 AI 怎么 import `@/supabase`
  3. Sandpack 注入一个共享 `supabase` 实例（用受限 anon key）
  4. UI 加「数据」标签页展示生成的表

---

## 技术细节

- i18n 实现避免 `react-i18next`：自己写约 80 行 Context + Hook 即可
- 横幅用 shadcn `Alert` 组件，已存在
- 语言切换不刷新页面，组件全用 `useT()` 拿翻译
- `index.tsx` 的 `head()` meta 也要随语言切换（用 `head: ({ match }) => ...` 暂不可行——TanStack head 是静态的，改成两套 meta 同时挂或用 client-side `document.title` 兜底）

## 文件清单
- 新增：`src/lib/i18n.tsx`、`src/lib/i18n-dict.ts`、`src/components/MobileWarningBanner.tsx`、`src/components/LanguageToggle.tsx`
- 修改：`src/routes/__root.tsx`、`src/components/site/SiteHeader.tsx`、`src/components/site/SiteFooter.tsx`、`src/routes/index.tsx`、`src/routes/settings.tsx`、`src/routes/project.$projectId.tsx`

第 3、4 项会在实现完 1、2 后用文字答复，不改代码。
