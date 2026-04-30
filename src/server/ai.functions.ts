import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * 系统提示词 — 这是 AI 的"灵魂"。
 * 设计原则：
 *  - 强约束输出格式（HTML 必须用 ```html 包裹）
 *  - 强约束视觉风格（深色、玻璃拟态、渐变、微动效）
 *  - 增量编辑：当用户描述修改时，必须基于已有 HTML 改，而不是重写
 *  - 完整可运行：单文件、Tailwind CDN、内联 SVG
 */
const SYSTEM_PROMPT = `你是"特挠率i额外"——一个 AI 网页生成助手。用户用自然语言描述他们想要的网页，你需要：

1. 用友好、简洁的中文回应一两句你将要做什么。
2. 输出一个**完整的、独立运行的 HTML 文档**，包含 <!DOCTYPE html> 到 </html>，使用：
   - Tailwind CDN：<script src="https://cdn.tailwindcss.com"></script>
   - 内联 SVG 图标
   - 现代、精致的视觉：深色主题、紫粉渐变、玻璃拟态、流畅微动画、响应式
   - 真实可用的内容（不要 lorem ipsum，按用户描述生成对应文案）
3. HTML 必须严格用三个反引号 + html 标记的代码块包裹：\`\`\`html ... \`\`\`
4. **增量修改**：如果用户在已有项目上提出修改，必须基于上一版 HTML 做最小改动，保留原有结构与内容，仅修改用户提到的部分。
5. 不要解释 HTML 细节，让代码自己说话。

要求：响应式、视觉精美、交互流畅、即开即用。每次只输出一个完整 HTML 文档。`;

const inputSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
});

/**
 * 调用 Lovable AI Gateway。
 * 当前用 LOVABLE_API_KEY；如果用户后续想接入自有 OpenAI / 其他兼容 OpenAI 的 key，
 * 只需把这个函数里的 endpoint / apiKey 换成对应的环境变量即可。
 *
 * 兼容自定义模型 key（按优先级）：
 *   1. CUSTOM_AI_API_KEY + CUSTOM_AI_BASE_URL + CUSTOM_AI_MODEL（用户私钥）
 *   2. LOVABLE_API_KEY（默认）
 */
function getAIConfig() {
  const customKey = process.env.CUSTOM_AI_API_KEY;
  if (customKey) {
    return {
      apiKey: customKey,
      baseUrl: process.env.CUSTOM_AI_BASE_URL ?? "https://api.openai.com/v1",
      model: process.env.CUSTOM_AI_MODEL ?? "gpt-4o-mini",
    };
  }
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    return {
      apiKey: lovableKey,
      baseUrl: "https://ai.gateway.lovable.dev/v1",
      model: "google/gemini-2.5-flash",
    };
  }
  return null;
}

export const generateWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const cfg = getAIConfig();
    if (!cfg) {
      throw new Error(
        "AI 未配置：请在后端设置 LOVABLE_API_KEY，或自定义 CUSTOM_AI_API_KEY / CUSTOM_AI_BASE_URL / CUSTOM_AI_MODEL。",
      );
    }

    // Verify project ownership
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, preview_html")
      .eq("id", data.projectId)
      .eq("user_id", userId)
      .single();
    if (pErr || !project) throw new Error("项目未找到");

    // Load chat history (cap to last 20 turns to control token usage)
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Save user message immediately so UI can show it on refresh
    await supabase.from("messages").insert({
      project_id: data.projectId,
      user_id: userId,
      role: "user",
      content: data.prompt,
    });

    // Build messages: include current HTML as additional context for incremental edits
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (project.preview_html) {
      messages.push({
        role: "system",
        content: `当前页面 HTML（用户基于这个版本进行修改）：\n\`\`\`html\n${project.preview_html.slice(0, 12000)}\n\`\`\``,
      });
    }

    for (const m of history ?? []) {
      // Strip raw HTML from past assistant messages — we already injected the latest above
      const content =
        m.role === "assistant"
          ? m.content.replace(/```html[\s\S]*?```/gi, "（生成了一版 HTML）")
          : m.content;
      messages.push({ role: m.role, content });
    }
    messages.push({ role: "user", content: data.prompt });

    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: 0.7,
        }),
      });
    } catch (err) {
      console.error("AI fetch failed", err);
      throw new Error("无法连接 AI 服务，请稍后再试");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("AI gateway error", res.status, text);
      if (res.status === 429) throw new Error("AI 请求过于频繁，请稍后再试");
      if (res.status === 402) throw new Error("AI 额度已用完，请前往工作区添加额度");
      if (res.status === 401) throw new Error("AI Key 无效，请检查后端配置");
      throw new Error(`AI 调用失败（${res.status}）`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = json.choices?.[0]?.message?.content ?? "（无内容）";

    // Extract HTML block
    const htmlMatch = reply.match(/```html\s*\n([\s\S]*?)```/i);
    const newHtml = htmlMatch?.[1]?.trim() ?? null;

    // Save assistant message
    await supabase.from("messages").insert({
      project_id: data.projectId,
      user_id: userId,
      role: "assistant",
      content: reply,
    });

    // Update preview if HTML present
    if (newHtml) {
      await supabase
        .from("projects")
        .update({ preview_html: newHtml, updated_at: new Date().toISOString() })
        .eq("id", data.projectId);
    }

    return { reply, html: newHtml };
  });

/**
 * 切换项目公开 / 私有，用于"分享链接"。
 */
export const toggleProjectPublic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid(), isPublic: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .update({ is_public: data.isPublic })
      .eq("id", data.projectId)
      .eq("user_id", userId);
    if (error) throw new Error("更新失败");
    return { ok: true };
  });
