export type AIProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** DashScope / OpenAI-compatible extra headers */
  headers?: Record<string, string>;
};

/**
 * Resolve AI backend (priority: 阿里云百炼 DashScope → 自定义 OpenAI 兼容 → Lovable)。
 * DashScope 文档：https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-by-calling-api
 */
export function getAIConfig(): AIProviderConfig | null {
  const dashKey =
    process.env.DASHSCOPE_API_KEY?.trim() ||
    process.env.ALIBABA_CLOUD_API_KEY?.trim() ||
    process.env.QWEN_API_KEY?.trim();
  if (dashKey) {
    return {
      apiKey: dashKey,
      baseUrl:
        process.env.DASHSCOPE_BASE_URL?.trim() ||
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: process.env.DASHSCOPE_MODEL?.trim() || "qwen-plus",
    };
  }

  const customKey = process.env.CUSTOM_AI_API_KEY?.trim();
  if (customKey) {
    return {
      apiKey: customKey,
      baseUrl: process.env.CUSTOM_AI_BASE_URL?.trim() || "https://api.openai.com/v1",
      model: process.env.CUSTOM_AI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  const lovableKey = process.env.LOVABLE_API_KEY?.trim();
  if (lovableKey) {
    return {
      apiKey: lovableKey,
      baseUrl: "https://ai.gateway.lovable.dev/v1",
      model: "google/gemini-2.5-flash",
    };
  }

  return null;
}

export async function chatCompletionNonStream(
  cfg: AIProviderConfig,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      ...cfg.headers,
    },
    body: JSON.stringify(body),
  });
}

export async function chatCompletionStream(
  cfg: AIProviderConfig,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      ...cfg.headers,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });
}
