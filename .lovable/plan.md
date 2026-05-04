# 总体规划

分三个阶段，先修 bug 再补齐功能，最后做发布/国内访问优化。

---

## 阶段 1：修复 AI 流式生成（先做，立刻生效）

**根因**：`api.ai.stream.ts` 里 `consumeCredits` 用了 `supabaseAdmin`（service role key），Worker 运行时该 env 缺失 → 函数抛错 → 流没产生 → 前端 90s 超时。同时管理员账号没有 `user_credits` 行。

**改动**：
1. 把扣费逻辑从 `client.server.ts` 改为走数据库函数 `consume_credits`（已存在，SECURITY DEFINER），用**已认证的用户 supabase 客户端** RPC 调用，无需 service role。
2. `api.ai.stream.ts` 里：管理员（`has_role admin`）跳过扣费；普通用户走 RPC 扣 1 积分。
3. 数据库迁移：补给所有现有 `auth.users` 缺失的 `user_credits` 记录（30 bonus）；管理员账号确保有记录。
4. 在流开头先发一个 `{type:"ready"}` 心跳，前端立刻知道连接已建立，避免误判超时。

---

## 阶段 2：补齐 Lovable 风格功能

### 2.1 用户剩余点数（前端展示完善）
- `CreditBadge` / `CreditsPanel` 已经存在，确认绑定 `getMyCredits` server fn，在 header 和 dashboard 都显示。
- 项目编辑器顶栏显示「剩余 X 点」，每次生成后自动刷新。
- 余额不足时弹窗提示去充值（链接到 `/pricing`）。

### 2.2 管理员后台 `/admin`
新建受 `has_role(admin)` 保护的路由组，包含：
- **概览**：总用户数、今日生成数、积分消耗、活跃项目数。
- **用户管理**：列表（邮箱、注册时间、套餐、剩余积分、角色）；可手动加减积分、改套餐、授予/撤销 admin、封禁。
- **项目管理**：所有项目列表，可强制下线公开项目。
- **积分流水**：全局 `credit_transactions` 查询。
- **邮件日志**：`email_send_log` 查询，便于排查邮件问题。

技术：新增 `src/routes/_admin.tsx` layout（`beforeLoad` 校验 admin 角色），子路由 `_admin/index.tsx`、`_admin/users.tsx`、`_admin/projects.tsx`、`_admin/credits.tsx`、`_admin/emails.tsx`。所有数据通过 `createServerFn + requireSupabaseAuth` + 二次校验 admin 角色后用 `supabaseAdmin` 查询。

### 2.3 支付（仅预留，不接入真实支付）
按你之前的指示，**只预留接口**：
- `/pricing` 页面三档（Free / Pro 100点/月 / Team 500点/月），点「升级」走占位流程。
- 新建 `payment_orders` 表（user_id, plan, amount, status, created_at），状态 `pending/paid/failed`。
- 新建 server fn `createOrder(plan)`：插入 pending 订单，返回订单号；前端展示「请联系管理员付款，付款后管理员手动激活」的提示页（含订单号、二维码占位图）。
- 管理员后台「订单管理」页：可手动把订单标记为 `paid`，触发：升级 `user_credits.plan`、补发对应月度积分。
- 后续真接 Stripe/Paddle 时，只要替换 `createOrder` 的实现，前端无需改动。

### 2.4 项目编辑器内的「我的项目」「设置」完善
- Dashboard 已有，确认列表分页、搜索、删除项目功能正常。
- Settings 页加「修改密码」「修改昵称头像」「查看积分流水」三个 tab。

---

## 阶段 3：发布与国内访问优化

延续之前 `.lovable/plan.md` 已规划的方案：

### 3.1 短链 publish
- `projects.public_slug` 字段已有 + `generate_project_slug()` 函数已有 ✅
- 路由 `src/routes/s.$slug.tsx` 已存在 ✅，确认 `PublishDialog` 显示 `/s/{slug}` 短链 + 复制按钮 + 改 slug。

### 3.2 Sandpack 国内可访问
- A 方案：`<SandpackProvider>` 读 `VITE_SANDPACK_BUNDLER_URL`，留空走默认。先加这个开关，未来你部署自托管 bundler 时填进去即可。
- B 方案（默认 publish 行为）：发布时调用 `src/lib/publish-snapshot.ts`（已存在）用 esbuild-wasm 在浏览器里把 sandpack files 打成单文件 HTML，写入 `projects.preview_html`；公开页 `/s/:slug` 优先 iframe srcDoc 渲染快照，没快照才 fallback 到 sandpack。

### 3.3 自定义域名 `ai.tensorview.cc`
不在代码里做，由你在 Lovable 项目设置 → 自定义域名里绑定，然后在你的 DNS 服务商加 CNAME。我会在交付时给你具体步骤。

---

## 设计上需要你拍板的 1 件事

**支付占位流程的用户文案**：用户点「升级到 Pro」后看到什么？
- 选项 A：弹窗显示订单号 + 你的微信/支付宝收款码（你提供图）+「付款后联系管理员激活」。
- 选项 B：跳转到一个表单，让用户留邮箱/微信号，管理员后台审核后激活。
- 选项 C：暂时直接禁用按钮，显示「即将开放」。

如果你不指定，我**默认选 C**（最稳，不引入未验证的资金流），管理员后台仍保留手动加额度的能力，你想给谁开 Pro 直接后台点。

---

## 实施顺序（确认后我会按这个走）

1. **修 AI 生成** + 补 user_credits + admin bypass（一次提交，立刻可用）
2. **管理员后台**（`/admin` 全套页面）
3. **积分展示完善** + Settings 完善
4. **支付占位**（按你选的方案）
5. **publish 快照** + sandpack bundler 开关
6. 给你自定义域名绑定步骤说明

确认后回复"开始"或指出要调整的地方，我就按这个顺序开干。
