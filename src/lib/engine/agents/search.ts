import { extractJson, llmChat, llmEnabled } from "../llm";
import type { AgentOutput, RawCandidate } from "../types";
import { hypothesisToCandidate } from "../util";

const SYSTEM_PROMPT = `You are the Knowledge Search Agent of Locus, an OSINT geolocation platform. Given visual clues reported by other agents and/or a free-text event description, you rank the most likely real-world locations using internal knowledge: geography, landmark inventories, news events, administrative divisions, and place names.

Respond with ONLY a JSON object (no prose, no markdown) of this exact shape:
{
  "strategy": "one short paragraph on how you localised the input",
  "candidates": [{"label": "specific place or region, country", "latitude": number, "longitude": number, "confidence": number, "radius_km": number, "reasoning": "the knowledge that supports this"}]
}

Rules: 1-4 candidates, most likely first; confidence at most 0.6 (knowledge-only evidence is weaker than visual or EXIF evidence); radius_km at least 15; precise coordinates for specific places.`;

interface SearchJson {
  strategy?: unknown;
  candidates?: unknown[];
}

export async function runSearchAgent(input: {
  description?: string;
  priorSummaries: { agent: string; summary: string }[];
}): Promise<AgentOutput> {
  if (!llmEnabled()) {
    return {
      skipped: true,
      skipReason: "Knowledge search requires an AI provider (set AI_API_KEY).",
      candidates: [],
      evidence: [],
      summary: "Skipped: no AI provider configured",
    };
  }

  const context: string[] = [];
  if (input.description) context.push(`Event/incident description: ${input.description}`);
  for (const p of input.priorSummaries) {
    if (p.summary) context.push(`${p.agent} agent reported: ${p.summary}`);
  }
  if (context.length === 0) {
    return {
      skipped: true,
      skipReason: "Nothing to search on — provide a description or visual clues.",
      candidates: [],
      evidence: [],
      summary: "Skipped: no input",
    };
  }

  const res = await llmChat({
    system: SYSTEM_PROMPT,
    user: `Using world knowledge, rank the most likely locations for the following. Return the JSON object.\n\n${context.join(
      "\n\n",
    )}`,
    maxTokens: 1200,
  });

  const parsed = extractJson<SearchJson>(res.content);
  const candidates: RawCandidate[] = [];
  for (const h of Array.isArray(parsed.candidates) ? parsed.candidates : []) {
    const c = hypothesisToCandidate(h as Record<string, unknown>, "search", { maxConfidence: 0.6, minRadiusKm: 15 });
    if (c) candidates.push(c);
  }

  const evidence: AgentOutput["evidence"] = [];
  const strategy = typeof parsed.strategy === "string" ? parsed.strategy.trim() : "";
  if (strategy) {
    evidence.push({ kind: "search-strategy", title: "Knowledge search strategy", detail: strategy, weight: "moderate" });
  }

  return {
    candidates,
    evidence,
    summary: strategy ? strategy : `${candidates.length} knowledge candidate(s)`,
    tokensIn: res.tokensIn,
    tokensOut: res.tokensOut,
  };
}
