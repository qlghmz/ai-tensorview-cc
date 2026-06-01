
## 思路（参考 Lovable 的方式）

Lovable 遇到"需要后端 / 第三方 API"时不会闷头硬写，而是：
1. 在 chat 里先抛出 **plan 卡片**，列出 2–3 个方案 + 利弊；
2. 用户选完，再要 Key（如果需要）；
3. 然后才写代码。

我们把这套搬到自己的生成器里：让 AI 在生成前自己判断"这页面要不要后端"，要的话先发 plan，而不是默认搞个假表单。

---

## 1. 生成侧：加一个"plan-first"前置节点

修改 `src/lib/ai-generate-shared.ts` 里的多页并行生成流程，前面加一步 **意图扫描**：

- 第 1 次 model 调用：只让模型读用户 prompt，输出 JSON：
  ```
  { needsBackend: boolean,
    backendFeatures: ["sms_otp", "email_login", "form_submit", "payment", ...],
    proposal: { title, options: [{label, desc, requires:["ALI_SMS_*"]}, ...] } }
  ```
- 如果 `needsBackend=false`：走老逻辑，直接生成多页。
- 如果 `needsBackend=true`：**不生成代码**，而是把 `proposal` 作为一条 assistant 消息回到 chat（前端渲染成"方案卡片 + 选项按钮"），等用户回复"用方案 A / B / C"后再继续。

每个能力对应一个"后端配方"（写死的 prompt 片段 + 需要的 env 列表）。首批支持：
- **短信验证码**：方案 A=前端 Mock（验证码弹窗显示，零成本），方案 B=阿里云短信（需 `ALI_SMS_ACCESS_KEY_ID/SECRET/SIGN_NAME/TEMPLATE_CODE`）。默认推荐 A。
- **邮箱注册/登录**：方案 A=前端 localStorage Mock，方案 B=接 Lovable AI Gateway 旁的轻量邮件服务（已有 LOVABLE_API_KEY 体系），方案 C=接用户自己的 Resend Key。
- **表单提交 / 留言**：方案 A=Mock，方案 B=写一个 `/api/contact.ts` serverless，落到 webhook（用户给 URL）。
- **支付**：始终 Mock，提示"上线请接 Stripe/支付宝"。

用户选完，AI 在下一轮：
- 生成对应的 `/api/*.ts`（Web 标准 Request/Response，Vercel & EdgeOne Pages Functions 都能跑）；
- 在前端 form 里把 fetch 接到 `/api/...`；
- 如果方案需要 Key，在 chat 里**用 add_secret 工具向客户索要**（参考 Lovable）。

> 关键：plan 决策是模型生成的，不是我硬编码的清单。我只提供"已知能力→需要哪些 env"的配方表，模型自由组合。

## 2. Key 注入到客户的部署里

客户填的 `ALI_SMS_*` 这种业务 Key，存到 `user_deploy_tokens` 表新加的 `env_vars jsonb` 字段（加密同样用 deploy-token-crypto）。部署时：
- **Vercel**：调 `POST /v10/projects/{id}/env` 把这些 env 推上去；
- **EdgeOne**：当前我们用的"一次性 HTML 托管"接口不支持 env，所以生成"含后端"的站点时，EdgeOne 这一栏置灰，提示"需切到 Vercel 才能部署后端"。

## 3. 修复部署链接 Bug（图二的 `expected POST method. Got GET`）

复现确认：那条 `ai.tensorview.cc/_serverFn/...` 其实是 TanStack 给 `publishToEdgeOne` 这个 serverFn 自动生成的内部 RPC 端点。

**根因**：当 EdgeOne 接口偶发返回非 JSON / 空 body 时，前端 `res.url` 是 `undefined`，但旧代码没拦住就 `setCurrentUrl(undefined)`，然后某次 useEffect 把 fallback 写成了 RPC URL；或者更可能——`fetch('/api/public/indexnow', …)` 这类相对路径在某个浏览器扩展里被替换。但直接证据是 PublishDialog 把 `res.url` 当真。

修法（小改，定位精准）：
1. `edgeone-deploy.functions.ts` 里 deploy 成功后**再加一层防御**：URL 必须满足 `/^https:\/\/.+\.edgeone\.(app|site)/`，否则 throw。
2. `PublishDialog.tsx` 的 `<a href={currentUrl}>`：只有当 `currentUrl` 通过同样正则才渲染，否则显示 "部署返回异常，请重试" + 把原始返回打到 toast。
3. 数据库里那条已经污染的 `published_url`：加个 migration，把所有以 `/_serverFn/` 结尾的 `published_url` 清成 null。

## 4. 顺手把 UI 文案接上

`i18n-dict.ts` 加：
- `publish.edgeone.invalidUrl`
- `chat.backendPlan.title` / `.pickOption` / `.needsKey`
- 短信/邮件方案卡片用到的文案。

---

## 文件清单

- `src/lib/ai-generate-shared.ts`：加 plan-first 阶段 + 配方表
- `src/lib/backend-recipes.ts`（新）：能力→env→prompt 片段
- `src/components/lovable/...` 聊天气泡：新增"方案卡片"渲染分支
- `src/server/vercel-deploy.functions.ts`：部署时同步 env_vars
- `src/server/edgeone-deploy.functions.ts`：URL 严格校验
- `src/components/PublishDialog.tsx`：URL 校验 + 错误提示
- `supabase/migrations/...`：`user_deploy_tokens.env_vars jsonb` + 清洗脏 `published_url`
- `src/lib/i18n-dict.ts`：文案

## 不会动

之前生成的 EdgeOne / Vercel 流程主干、auth、积分、UI 主题——只新增，不重写。

---

确认这个方向我就开干。要不要把"plan-first"也用到非后端场景（比如"做电商还是做博客"这种大方向也先 plan）？默认我**只对后端能力 plan**，避免拖慢普通生成。
