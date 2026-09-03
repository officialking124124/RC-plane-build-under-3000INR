import { NextResponse } from "next/server";
import { llmConfig, llmEnabled } from "@/lib/engine/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = llmConfig();
  let provider = "unknown";
  try {
    provider = new URL(cfg.baseUrl).host;
  } catch {
    provider = cfg.baseUrl;
  }
  return NextResponse.json({
    status: "ok",
    ai: { configured: llmEnabled(), model: cfg.model, provider },
    time: new Date().toISOString(),
  });
}
