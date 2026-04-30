/** Try to read a complete ```html ... ``` block from accumulated model output. */
export function extractCompleteHtmlBlock(full: string): string | null {
  const re = /```html\s*\n([\s\S]*?)```/i;
  const m = full.match(re);
  return m?.[1]?.trim() ?? null;
}

/**
 * While the model is still writing, show a "best effort" preview after the opening fence
 * (may be invalid HTML until the stream finishes).
 */
export function extractPartialHtmlAfterFence(full: string): string | null {
  const marker = /```html\s*\n/i;
  const m = full.match(marker);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  const rest = full.slice(start);
  const closeIdx = rest.indexOf("```");
  const inner = closeIdx === -1 ? rest : rest.slice(0, closeIdx);
  const t = inner.trim();
  if (t.length < 12) return null;
  return t;
}
