// 极简 Markdown 渲染器，仅支持文档教程里用到的语法：
// # / ## / ### 标题、段落、- 列表、```代码块```、**加粗**、`行内代码`、[text](url)
// 故意不引入 markdown 库，保持零依赖、SSR 友好。

import type { ReactNode } from "react";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function renderInline(text: string): string {
  let t = escapeHtml(text);
  // 行内代码
  t = t.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-muted text-foreground text-[0.9em]">$1</code>');
  // 加粗
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // 链接
  t = t.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-brand underline underline-offset-4 hover:opacity-80">$1</a>',
  );
  return t;
}

export function renderMarkdown(md: string): ReactNode {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        `<pre class="my-5 overflow-x-auto rounded-xl glass p-4 text-sm leading-relaxed"><code data-lang="${escapeHtml(
          lang,
        )}">${escapeHtml(buf.join("\n"))}</code></pre>`,
      );
      continue;
    }

    // 标题
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const tag = `h${level}`;
      const cls =
        level === 1
          ? "mt-10 mb-6 text-3xl md:text-4xl font-bold"
          : level === 2
            ? "mt-10 mb-4 text-2xl font-semibold"
            : "mt-6 mb-3 text-xl font-semibold";
      blocks.push(`<${tag} class="${cls}">${renderInline(h[2])}</${tag}>`);
      i++;
      continue;
    }

    // 无序列表
    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(`<li class="my-1.5">${renderInline(lines[i].replace(/^-\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ul class="my-4 ml-6 list-disc space-y-1 text-muted-foreground">${items.join("")}</ul>`);
      continue;
    }

    // 空行
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 段落（吃到下一个空行）
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !/^-\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(`<p class="my-4 leading-7 text-muted-foreground">${renderInline(para.join(" "))}</p>`);
  }

  return <div className="prose-like" dangerouslySetInnerHTML={{ __html: blocks.join("\n") }} />;
}
