import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SYSTEM_PROMPT = `你是"特挠率i额外"——一个 AI 网页生成助手。用户用自然语言描述他们想要的网页，你需要：

1. 用友好、简洁的中文先回应一句你将要做什么（一两句话）。
2. 然后输出一个**完整的、独立运行的 HTML 文档**，包含 <!DOCTYPE html> 到 </html>，使用 Tailwind CDN（<script src="https://cdn.tailwindcss.com"></script>）、内联 SVG、现代美观的设计（深色主题、渐变、玻璃拟态、流畅动画）。
3. HTML 必须严格用三个反引号 + html 标记的代码块包裹，例如：\`\`\`html ... \`\`\`。
4. 不要解释 HTML 的细节，让代码自己说话。

要求：响应式、视觉精美、交互流畅、即开即用。`;

const inputSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
});

export const generateWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI 服务未配置");

    // Verify project ownership
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, preview_html")
      .eq("id", data.projectId)
      .eq("user_id", userId)
      .single();
    if (pErr || !project) throw new Error("项目未找到");

    // Load history
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true })
      .limit(40);

    // Save user message
    await supabase.from("messages").insert({
      project_id: data.projectId,
      user_id: userId,
      role: "user",
      content: data.prompt,
    });

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.prompt },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI 请求过于频繁，请稍后再试");
      if (res.status === 402) throw new Error("AI 额度已用完，请前往 Lovable 工作区添加额度");
      throw new Error(`AI 调用失败: ${text.slice(0, 200)}`);
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
