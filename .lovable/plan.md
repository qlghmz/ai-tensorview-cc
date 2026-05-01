我会按两个方向一起修：先解决发布时 `dist-check failed` 的根因，再把 AI 生成过程改成 Lovable 风格的“运行中状态”，避免客户看到半截代码、空白、突然更新。

## 目标 1：稳定发布，解决 dist-check 失败

我会重点处理目前最可疑的发布失败点：

1. **移除/替换不适合发布检查的自定义 Vercel/Nitro 配置**
   - 当前 `vite.config.ts` 里手动加入了 `nitro({ preset: "vercel" })`，同时 `vercel.json` 又强制 Vercel 用 `npm run build` / `npm install`。
   - 这会让发布平台的 dist 检查更容易和 Lovable/TanStack Start 默认产物不一致，尤其是项目同时存在 `bun.lockb` 和 `package-lock.json` 时。
   - 我会恢复到 Lovable/TanStack Start 更标准的构建路径：保留必要的 Sandpack SSR 防护，但去掉多余/冲突的发布配置。

2. **修正 Sandpack 在 SSR/发布检查中的风险点**
   - Sandpack 依赖浏览器环境，之前用动态 import + SSR stub 规避了一部分问题。
   - 我会进一步让 Sandpack 组件彻底成为“客户端专用组件”：
     - 页面和公共预览路由不在服务端渲染 Sandpack；
     - SSR stub 只作为兜底；
     - 避免服务端构建产物里错误打入真实 Sandpack 运行代码。

3. **检查发布锁文件一致性**
   - 当前项目有 `bun.lockb` 和 `package-lock.json`，而 `vercel.json` 指定 npm 安装，容易让发布环境和本地/预览环境解析依赖不一致。
   - 我会调整发布配置，避免强制 npm 路径；必要时同步或清理冲突配置，让发布使用项目默认的 Lovable 构建方式。

## 目标 2：优化 AI 生成时的交互体验

现在的问题是：流式返回时聊天区会先显示部分代码块，随后因为代码块替换/解析导致看起来变空，最后预览突然更新。这个体验很像“卡住了”。我会改成：

1. **生成中不显示具体代码**
   - assistant 消息在生成期间只显示状态卡片，例如：
     - “正在理解需求”
     - “正在生成 React 页面结构”
     - “正在组装多页面预览”
     - “正在保存并更新预览”
   - 不再把 ` ```lovable ... ``` ` 或 HTML/代码流实时渲染给用户。

2. **只在最终完成后更新预览**
   - 当前收到中间 `preview` 事件就会实时 setProject，可能造成预览闪烁或突然切换。
   - 我会改成先在内存里缓存生成结果；只有收到 `final` 且 bundle 验证通过后，才一次性更新右侧预览，并提示“已更新预览”。

3. **增加明确的运行反馈**
   - 左侧聊天底部展示持续的运行状态，不让用户误以为没动静。
   - 发送按钮禁用时显示 loading；输入框提示“AI 正在运行”。
   - 如果生成失败，保留用户输入消息，并显示清晰错误，不再直接把临时对话全部删除导致用户不知道发生了什么。

4. **完善流式解析的边界情况**
   - 处理最后一行没有换行的 NDJSON；
   - 处理无 final / 生成中断；
   - 如果最终没有可用 React bundle，显示“生成未完成，请重试或补充要求”，而不是静默空白。

## 目标 3：发布前防回归

实现后我会做这些验证：

1. 确认项目代码不再依赖发布环境中的真实浏览器全局变量；
2. 确认 `/project/:id` 和 `/p/:id` 的客户端预览仍能正常加载；
3. 确认 AI 生成期间聊天区只显示状态，不显示半截代码；
4. 确认完成后右侧预览一次性更新；
5. 让自动构建/发布检查重新跑，重点观察 `dist-check` 是否消失。

## 预计改动文件

- `vite.config.ts`
- `vercel.json`（可能删除或简化发布强制配置）
- `src/routes/project.$projectId.tsx`
- `src/components/lovable/ClientLovableSandpack.tsx`
- `src/components/lovable/LovableSandpack.tsx`
- 可能补充一个小型的生成状态组件或 helper，保持代码更清晰

如果你批准，我会开始实施这些修改。