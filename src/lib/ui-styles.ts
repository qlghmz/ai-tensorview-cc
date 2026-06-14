export type UiStylePreset = {
  id: string;
  label: string;
  labelEn: string;
  emoji: string;
  promptHint: string;
};

export const UI_STYLE_PRESETS: UiStylePreset[] = [
  {
    id: "minimal-saas",
    label: "极简 SaaS",
    labelEn: "Minimal SaaS",
    emoji: "✨",
    promptHint: "极简 SaaS 风格：大量留白、清晰层级、柔和阴影、圆角卡片、蓝紫渐变点缀。",
  },
  {
    id: "dark-dev",
    label: "深色开发者",
    labelEn: "Dark developer",
    emoji: "🌙",
    promptHint: "深色开发者风格：深灰背景、等宽字体标题、代码感边框、霓虹 accent 色。",
  },
  {
    id: "warm-commerce",
    label: "暖色电商",
    labelEn: "Warm commerce",
    emoji: "🛍️",
    promptHint: "暖色电商风格：大图 Hero、促销标签、商品网格、信任背书区块。",
  },
  {
    id: "corporate",
    label: "企业官网",
    labelEn: "Corporate",
    emoji: "🏢",
    promptHint: "企业官网风格：稳重配色、数据指标、客户 Logo 墙、清晰 CTA。",
  },
  {
    id: "playful",
    label: "活泼创意",
    labelEn: "Playful",
    emoji: "🎨",
    promptHint: "活泼创意风格：大胆配色、插画感布局、微动效暗示、友好文案。",
  },
];

export function styleHintForId(id: string | null | undefined): string {
  if (!id) return "";
  return UI_STYLE_PRESETS.find((s) => s.id === id)?.promptHint ?? "";
}

export function applyStyleToPrompt(prompt: string, styleId: string | null | undefined): string {
  const hint = styleHintForId(styleId);
  if (!hint) return prompt.trim();
  return `${prompt.trim()}\n\n【视觉风格要求】${hint}`;
}
