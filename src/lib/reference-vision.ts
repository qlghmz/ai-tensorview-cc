import type { AIProviderConfig } from "@/lib/ai-config";
import { chatCompletionNonStream, getAIConfigChain } from "@/lib/ai-config";

export type ReferenceInput = {
  imageDataUrl?: string;
  figmaUrl?: string;
};

export function appendReferenceToPrompt(prompt: string, ref: ReferenceInput): string {
  let out = prompt;
  if (ref.figmaUrl?.trim()) {
    out += `\n\n[Figma 设计参考] ${ref.figmaUrl.trim()} — 请尽量还原布局、配色与组件层级。`;
  }
  if (ref.imageDataUrl) {
    out += "\n\n[已附加 UI 截图参考，见视觉分析]";
  }
  return out;
}

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type VisionMessage = { role: string; content: string | ChatContentPart[] };

function supportsVision(cfg: AIProviderConfig): boolean {
  const m = cfg.model.toLowerCase();
  return (
    cfg.provider === "gemini" ||
    m.includes("vl") ||
    m.includes("vision") ||
    m.includes("gpt-4o") ||
    m.includes("gpt-4.1")
  );
}

export async function analyzeReferenceImage(
  imageDataUrl: string,
  userPrompt: string,
): Promise<string | null> {
  const chain = getAIConfigChain().filter(supportsVision);
  const configs = chain.length ? chain : getAIConfigChain();
  if (!configs.length) return null;

  const userContent: ChatContentPart[] = [
    {
      type: "text",
      text: `分析这张 UI 设计截图，输出给前端开发者的实现说明（布局、配色 hex、字体、组件、间距）。用户需求：${userPrompt.slice(0, 500)}`,
    },
    { type: "image_url", image_url: { url: imageDataUrl } },
  ];

  for (const cfg of configs) {
    try {
      const messages: VisionMessage[] = [{ role: "user", content: userContent }];
      const res = await chatCompletionNonStream(cfg, {
        model: cfg.model,
        messages,
        temperature: 0.2,
        max_tokens: 1500,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch {
      continue;
    }
  }
  return null;
}

export async function enrichPromptWithReferences(prompt: string, ref: ReferenceInput): Promise<string> {
  let enriched = appendReferenceToPrompt(prompt, ref);
  if (ref.imageDataUrl) {
    const analysis = await analyzeReferenceImage(ref.imageDataUrl, prompt);
    if (analysis) {
      enriched += `\n\n## 截图视觉分析\n${analysis}`;
    }
  }
  return enriched;
}
