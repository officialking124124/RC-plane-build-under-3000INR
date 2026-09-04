const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-4o";

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function llmConfig(): LlmConfig {
  return {
    baseUrl: (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || "",
    model: process.env.AI_MODEL || DEFAULT_MODEL,
  };
}

export function llmEnabled(): boolean {
  return llmConfig().apiKey.length > 0;
}

export interface LlmCall {
  system: string;
  user: string;
  images?: string[];
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LlmResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
}

/** Minimal OpenAI-compatible chat client with vision support (OpenRouter, OpenAI, vLLM, Ollama, ...). */
export async function llmChat(call: LlmCall): Promise<LlmResponse> {
  const cfg = llmConfig();
  if (!cfg.apiKey) throw new Error("AI provider not configured (set AI_API_KEY)");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call.timeoutMs ?? 90_000);

  const content: Array<Record<string, unknown>> = [{ type: "text", text: call.user }];
  for (const image of call.images ?? []) {
    content.push({ type: "image_url", image_url: { url: image } });
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        max_tokens: call.maxTokens ?? 2048,
        messages: [
          { role: "system", content: call.system },
          { role: "user", content },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("AI provider returned an empty response");
    return {
      content: text,
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Extracts the first JSON object from a model reply, tolerating code fences and prose. */
export function extractJson<T>(raw: string): T {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("model response contained no JSON object");
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new Error("model response contained malformed JSON");
  }
}
