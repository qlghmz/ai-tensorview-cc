
## 目标

在不破坏现有功能（中文界面 + 多页 i18n + EdgeOne 一键发布 + AI 生成）的前提下：

1. **多平台发布**：发布弹窗里让用户在两个 Tab 之间二选一
   - 国内：腾讯云 EdgeOne（已有，保留）
   - 海外：Vercel（新增）
2. **账号模式（参考 Lovable）**：用户带自己的 Token，平台不代付费
   - 弹窗里有「去 Vercel 创建 Token」按钮，直接深链到 `https://vercel.com/account/tokens?name=TensorView&expiration=never`
   - 用户粘贴一次，平台加密保存到他自己的账号下（`user_deploy_tokens` 表，仅本人可读写），下次直接复用
   - 不做完整 OAuth（Vercel OAuth 需要审批且要回调 URL 备案，对国内项目不划算）
3. **生成内容升级：页面 + 后端接口**
   - AI 输出新增可选的 `api/*.ts` 文件（Vercel Serverless / Edge Function 格式）
   - 部署到 Vercel：原样工作
   - 部署到 EdgeOne：仅打包静态页（保持现状），UI 上提示"含后端的项目建议部署到 Vercel"
4. **自定义域名**：本轮不做（按你的要求）

## 用户流程

```text
点击「发布」
  ├─ Tab 1 国内 EdgeOne                ← 现有流程，按钮文案微调
  │     [立即发布] → *.edgeone.app
  │
  └─ Tab 2 海外 Vercel                 ← 新增
        ① 首次：输入框 + [去 Vercel 拿 Token ↗]
           粘贴 Token → [保存并发布]
        ② 已保存：直接 [发布到 Vercel]   (旁边小字「更换 Token」)
        部署中 → 拉取状态 → *.vercel.app
```

## 技术实现

### 1. 数据库（迁移）
新增 `public.user_deploy_tokens`：
- `user_id uuid` (FK auth.users)
- `provider text` ('vercel' | 'netlify' 预留)
- `token_encrypted text`（用 pgsodium / 简单 base64 + service role 隔离，仅 service_role 可读明文）
- `vercel_team_id text nullable`
- unique(user_id, provider)
- RLS: 用户只能 `select`/`delete` 自己的行（看是否存在），写入和读明文走 service_role 的 server fn。

在 `projects` 表加：
- `vercel_project_id text nullable`
- `vercel_deployment_url text nullable`

### 2. 服务端（TanStack server fn，不用 Edge Function）

新建 `src/server/vercel-deploy.functions.ts`：
- `saveVercelToken({ token, teamId? })`：校验 Token（GET `https://api.vercel.com/v2/user`），存库
- `getVercelTokenStatus()`：仅返回 `{ hasToken: true/false, scope }`，永不回传明文
- `deleteVercelToken()`
- `publishToVercel({ projectId })`：
  1. service_role 取明文 Token
  2. 复用 `buildPublishedHtml` 拿到 `index.html`
  3. 把当前项目的 `api/*` 文件（来自 Lovable bundle）一起打包
  4. 调 Vercel `POST /v13/deployments`，body: `{ name, files: [...], projectSettings: { framework: null } }`，files 用 `file` + `data`（base64）字段
  5. 轮询 `GET /v13/deployments/{id}` 直到 `READY`，回写 `vercel_deployment_url` + `is_public=true`

> Vercel REST 直接接受 files 数组，不用 git；同一个 `name` 第二次部署会自动落到同一个 project。

### 3. AI 生成扩展（增量，不改现有页面生成）

`src/lib/ai-generate-shared.ts`：
- system prompt 末尾追加：如果用户需求里有"接口/后端/表单提交/保存数据"等关键词，输出额外 `api/*.ts` 文件，签名固定为：
  ```ts
  export default async function handler(req: Request): Promise<Response> { ... }
  ```
  （这是 Vercel Edge Runtime 标准，也方便我们自己后续兼容 Cloudflare/EdgeOne Workers）
- `LovableBundle` 类型已经是 `Record<filename, content>`，把 `api/foo.ts` 一起塞进去即可，前端 sandpack 预览忽略（只渲染 html/css/js），部署时打包进去。

### 4. UI 调整

`src/components/PublishDialog.tsx` 重构成 Tabs：
- 顶部两个 Tab：国内（EdgeOne）/ 海外（Vercel），默认根据当前语言（中文=EdgeOne，英文=Vercel）
- EdgeOne Tab：完整保留现有 UI
- Vercel Tab：新增子组件 `VercelDeployPanel`
  - 未配 Token：输入框 + 「去 Vercel 拿 Token」按钮（target=_blank）+ 一行小说明「Token 只在你的账号下使用，平台加密保存」
  - 已配 Token：显示 Token 后 4 位 + 「发布」按钮 + 「更换」链接
  - 部署中：spinner + 当前阶段提示
  - 完成：复制链接、打开链接、重新部署
- 全部文案接 `t()`（中英文都覆盖）

### 5. i18n
`src/lib/i18n-dict.ts` 新增一组 `publish.vercel.*` / `publish.edgeone.*` / `publish.tabs.*` 键值。

### 6. 安全
- Vercel Token 只在 server fn + service_role 路径下解密使用；前端永不出现明文（即便回显也只显示尾 4 位）
- `saveVercelToken` 调一次 `https://api.vercel.com/v2/user` 校验有效性，失败直接拒收
- RLS：`user_deploy_tokens` 用户只能看到 "我有没有 token"，看不到明文；明文路径走 service_role
- 部署接口加积分扣费（沿用 `consume_credits`，例如每次 Vercel 部署 2 分），admin 用户不扣

### 7. 不影响的范围（明确列出，避免误改）
- 不动 `src/integrations/supabase/*`
- 不动现有 EdgeOne server fn / RPC
- 不动 i18n 检测、SEO head、auth、积分核心逻辑
- 不动 sandpack 预览（api 文件忽略即可）
- 不动现有路由结构

## 文件清单

新增：
- `supabase/migrations/<timestamp>_user_deploy_tokens.sql`
- `src/server/vercel-deploy.functions.ts`
- `src/components/publish/VercelDeployPanel.tsx`
- `src/components/publish/EdgeOneDeployPanel.tsx`（把现有 PublishDialog 内部抽出来）

修改：
- `src/components/PublishDialog.tsx`（改成 Tabs 外壳）
- `src/lib/i18n-dict.ts`（新增发布相关词条）
- `src/lib/ai-generate-shared.ts`（system prompt 增加可选 api 文件指令）
- `src/lib/publish-snapshot.ts`（导出一个把 bundle 拆成 `{ staticFiles, apiFiles }` 的小工具）

## 验证步骤

1. 现有 EdgeOne 发布流程跑通（回归）
2. Vercel：未配 Token → 弹输入框 → 拿 Token → 保存 → 触发部署 → 拿到 `*.vercel.app` 链接
3. 生成一个带「保存留言到接口」需求的项目 → AI 输出 `api/save.ts` → 部署到 Vercel → curl 接口能返回 200
4. 中英文切换，所有发布相关文案都对
5. 重新部署同一项目 → 用同一个 vercel_project_id，不会冒出新项目
