import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { extractCompleteHtmlBlock } from "@/lib/ai-stream-parse";

export const SYSTEM_PROMPT = `你是"特挠率i额外"——一个 AI 网页生成助手。用户用自然语言描述他们想要的网页，你需要：

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

export async function beginWebsiteGeneration(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  prompt: string,
): Promise<
  | {
      ok: true;
      messages: Array<{ role: string; content: string }>;
      projectId: string;
    }
  | { ok: false; response: Response }
> {
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("id, preview_html")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (pErr || !project) {
    return { ok: false, response: new Response("项目未找到", { status: 404 }) };
  }

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(20);

  await supabase.from("messages").insert({
    project_id: projectId,
    user_id: userId,
    role: "user",
    content: prompt,
  });

  const messages: Array<{ role: string; content: string }> = [{ role: "system", content: SYSTEM_PROMPT }];

  if (project.preview_html) {
    messages.push({
      role: "system",
      content: `当前页面 HTML（用户基于这个版本进行修改）：\n\`\`\`html\n${project.preview_html.slice(0, 12000)}\n\`\`\``,
    });
  }

  for (const m of history ?? []) {
    const content =
      m.role === "assistant"
        ? m.content.replace(/```html[\s\S]*?```/gi, "（生成了一版 HTML）")
        : m.content;
    messages.push({ role: m.role, content });
  }
  messages.push({ role: "user", content: prompt });

  return { ok: true, messages, projectId };
}

export async function persistGenerationResult(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  reply: string,
) {
  const newHtml = extractCompleteHtmlBlock(reply);

  await supabase.from("messages").insert({
    project_id: projectId,
    user_id: userId,
    role: "assistant",
    content: reply,
  });

  if (newHtml) {
    await supabase
      .from("projects")
      .update({ preview_html: newHtml, updated_at: new Date().toISOString() })
      .eq("id", projectId);
  }

  return { reply, html: newHtml };
}
