结论：阿里的模型是正常的。

我已直接用当前项目里的 DASHSCOPE_API_KEY 调了 qwen-plus：
- 最小 JSON 测试：HTTP 200，finish_reason=stop，正常返回 `{"ok": true, "msg": "pong"}`。
- 接近真实网页生成测试：HTTP 200，确实输出了 React 项目代码，并包含 ```lovable 和 `/App.tsx`。
- 用当前线上真实系统提示测试：HTTP 200，但 finish_reason=length，completion_tokens=8192，说明模型输出被我们设置的 `max_tokens: 8192` 截断了；因为截断时没有闭合 ```lovable 代码块，现有解析器拿不到完整 JSON，于是触发了之前加的“自动补全骨架页”，就显示了你看到的 TensorView 骨架。

所以不是阿里 Key 坏了，也不是模型完全没输出；是生成链路在长输出场景下失败后被兜底页面糊弄过去了。

修复计划：
1. 去掉“通用骨架页兜底”逻辑
   - 解析失败时不再保存 TensorView 骨架。
   - 保留明确错误：比如“模型输出被截断，请稍后重试/自动重试中”。

2. 调整阿里模型调用策略
   - 对 DashScope 不强行固定 `max_tokens: 8192`，改为遵循模型默认/最大输出，避免人为截断。
   - 同时记录 `finish_reason`，如果是 `length`，前端显示真实原因。

3. 收紧生成提示，减少无效超长输出
   - 禁止模型输出 tsconfig、vite config、package、超长 SVG/path/base64 等 Sandpack 不需要的文件。
   - 限制页面数量和文件体积，优先保证可运行、可预览。

4. 增强解析
   - 支持从未闭合文本中识别“明显截断”，不再当作成功。
   - 完整 JSON 才保存到项目预览。

5. 修复当前淘宝项目
   - 生成并保存一版真正的淘宝仿站 React 多文件项目到当前项目。
   - 验证数据库里 `preview_sandpack` 不再是骨架页，并且包含多个页面/组件文件。