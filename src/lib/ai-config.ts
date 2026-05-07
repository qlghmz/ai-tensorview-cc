export type AIProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** DashScope / OpenAI-compatible extra headers */
  headers?: Record<string, string>;
  /** 用于日志/调试，标识当前 provider */
  provider?: string;
};

/**
 * Resolve AI backend.
 * 优先级：阿里云百炼 DashScope（额度大，便宜） → Gemini（备用） → Lovable AI Gateway → 自定义。
 * 这样在某个 provider 超限/失败时上层可以 fallback。
 */
export function getAIConfig(): AIProviderConfig | null {
  return getAIConfigChain()[0] ?? null;
}

/**
 * 返回所有可用 provider 的配置（按优先级排序），调用方可逐个尝试。
 */
export function getAIConfigChain(): AIProviderConfig[] {
  const chain: AIProviderConfig[] = [];

  const dashKey =
    process.env.DASHSCOPE_API_KEY?.trim() ||
    process.env.ALIBABA_CLOUD_API_KEY?.trim() ||
    process.env.QWEN_API_KEY?.trim();
  if (dashKey) {
    chain.push({
      provider: "dashscope",
      apiKey: dashKey,
      baseUrl:
        process.env.DASHSCOPE_BASE_URL?.trim() ||
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: process.env.DASHSCOPE_MODEL?.trim() || "qwen-plus",
    });
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    // Gemini 提供 OpenAI 兼容接口
    chain.push({
      provider: "gemini",
      apiKey: geminiKey,
      baseUrl:
        process.env.GEMINI_BASE_URL?.trim() ||
        "https://generativelanguage.googleapis.com/v1beta/openai",
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    });
  }

  const lovableKey = process.env.LOVABLE_API_KEY?.trim();
  if (lovableKey) {
    chain.push({
      provider: "lovable",
      apiKey: lovableKey,
      baseUrl: "https://ai.gateway.lovable.dev/v1",
      model: "google/gemini-2.5-flash",
    });
  }

  const customKey = process.env.CUSTOM_AI_API_KEY?.trim();
  if (customKey) {
    chain.push({
      provider: "custom",
      apiKey: customKey,
      baseUrl: process.env.CUSTOM_AI_BASE_URL?.trim() || "https://api.openai.com/v1",
      model: process.env.CUSTOM_AI_MODEL?.trim() || "gpt-4o-mini",
    });
  }

  return chain;
}

/** 多页面 React 项目 JSON 通常需要较大输出窗口；默认拉到 8192 避免被截断。 */
const DEFAULT_MAX_TOKENS = 8192;

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
    body: JSON.stringify({
      max_tokens: DEFAULT_MAX_TOKENS,
      ...body,
      model: body.model ?? cfg.model,
    }),
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
    body: JSON.stringify({
      max_tokens: DEFAULT_MAX_TOKENS,
      ...body,
      model: body.model ?? cfg.model,
      stream: true,
    }),
  });
}
