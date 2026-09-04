import { extractJson, llmChat, llmEnabled } from "../llm";
import type { AgentOutput, RawCandidate } from "../types";
import { hypothesisToCandidate } from "../util";

const SYSTEM_PROMPT = `You are the Vision Agent of Locus, an OSINT geolocation platform, running in fast single-pass mode. You identify where photographs were taken using only visual evidence, and you also transcribe readable text.

Analyse the attached image(s) for geographic evidence: architecture, vegetation and biome, terrain, climate signals, road layout, vehicles and licence plates, utility infrastructure, text and language, and identifiable landmarks.

Respond with ONLY a JSON object (no prose, no markdown) of this exact shape:
{
  "scene_summary": "one short paragraph summarising the scene and its geographic signal",
  "clues": [{"category": "architecture|vegetation|terrain|infrastructure|language|vehicles|landmark|other", "observation": "what is visible", "significance": "where this pattern occurs geographically"}],
  "transcriptions": [{"text": "exact transcription", "context": "where it appears"}],
  "hypotheses": [{"label": "specific place or region, country", "latitude": number, "longitude": number, "confidence": number, "radius_km": number, "reasoning": "which clues support this"}]
}

Rules: 1-4 hypotheses, most likely first; confidence under 0.35 for continent/region level, above 0.7 only for visible specific landmarks; radius_km at least 200 for continent level and 1-10 only for specific landmarks; precise coordinates for landmarks.`;

interface VisionJson {
  scene_summary?: unknown;
  clues?: { category?: unknown; observation?: unknown; significance?: unknown }[];
  transcriptions?: { text?: unknown; context?: unknown }[];
  hypotheses?: unknown[];
}

export async function runVisionAgent(input: { images: string[] }): Promise<AgentOutput> {
  if (!llmEnabled()) {
    return {
      skipped: true,
      skipReason: "No AI provider configured (set AI_API_KEY) — vision analysis skipped.",
      candidates: [],
      evidence: [],
      summary: "Skipped: no AI provider configured",
    };
  }
  if (input.images.length === 0) {
    return { skipped: true, skipReason: "No images supplied.", candidates: [], evidence: [], summary: "Skipped: no images" };
  }

  const res = await llmChat({
    system: SYSTEM_PROMPT,
    user:
      input.images.length > 1
        ? `These ${input.images.length} images were captured at (or near) the same location. Cross-reference them and return the JSON object.`
        : "Analyse this image and return the JSON object.",
    images: input.images,
    maxTokens: 2000,
  });

  const parsed = extractJson<VisionJson>(res.content);
  const candidates: RawCandidate[] = [];
  for (const h of Array.isArray(parsed.hypotheses) ? parsed.hypotheses : []) {
    const c = hypothesisToCandidate(h as Record<string, unknown>, "vision", { maxConfidence: 0.88, minRadiusKm: 1 });
    if (c) candidates.push(c);
  }

  const evidence: AgentOutput["evidence"] = [];
  for (const clue of Array.isArray(parsed.clues) ? parsed.clues : []) {
    const observation = typeof clue.observation === "string" ? clue.observation.trim() : "";
    const significance = typeof clue.significance === "string" ? clue.significance.trim() : "";
    if (!observation) continue;
    evidence.push({
      kind: "visual-clue",
      title: typeof clue.category === "string" && clue.category.trim() ? clue.category.trim() : "visual clue",
      detail: significance ? `${observation} — ${significance}` : observation,
      weight: "moderate",
    });
  }
  for (const t of Array.isArray(parsed.transcriptions) ? parsed.transcriptions : []) {
    const text = typeof t.text === "string" ? t.text.trim() : "";
    if (!text) continue;
    evidence.push({
      kind: "signage",
      title: "Transcribed text",
      detail: `"${text}"`,
      weight: candidates.length > 0 ? "strong" : "moderate",
    });
  }

  const summary =
    typeof parsed.scene_summary === "string" && parsed.scene_summary.trim()
      ? parsed.scene_summary.trim()
      : `${candidates.length} hypothesis(es)`;

  return { candidates, evidence, summary, tokensIn: res.tokensIn, tokensOut: res.tokensOut };
}
