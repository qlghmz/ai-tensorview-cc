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
 * 优先级：阿里云百炼 DashScope（额度大，便宜） → Gemini（备用） → 自定义 OpenAI 兼容网关。
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

  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim() || process.env.LOVABLE_API_KEY?.trim();
  if (gatewayKey) {
    chain.push({
      provider: "gateway",
      apiKey: gatewayKey,
      baseUrl:
        process.env.AI_GATEWAY_BASE_URL?.trim() || "https://api.openai.com/v1",
      model: process.env.AI_GATEWAY_MODEL?.trim() || "gpt-4o-mini",
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

  const ollamaBase = process.env.OLLAMA_BASE_URL?.trim() || process.env.OLLAMA_HOST?.trim();
  if (ollamaBase) {
    chain.push({
      provider: "ollama",
      apiKey: process.env.OLLAMA_API_KEY?.trim() || "ollama",
      baseUrl: ollamaBase.replace(/\/$/, "").endsWith("/v1")
        ? ollamaBase.replace(/\/$/, "")
        : `${ollamaBase.replace(/\/$/, "")}/v1`,
      model: process.env.OLLAMA_MODEL?.trim() || "llama3.2",
    });
  }

  return chain;
}

/**
 * 不强行设置 max_tokens——阿里 qwen-plus 等模型默认上限远高于固定 8192，
 * 强制 8192 反而会在多页面项目里把 ```uibundle JSON 截断成无法解析。
 * 调用方需要时可在 body 里显式传入 max_tokens 覆盖。
 */
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
      ...body,
      model: body.model ?? cfg.model,
      stream: true,
    }),
  });
}
