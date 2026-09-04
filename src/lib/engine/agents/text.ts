import { extractJson, llmChat, llmEnabled } from "../llm";
import type { AgentOutput, RawCandidate } from "../types";
import { hypothesisToCandidate } from "../util";

const SYSTEM_PROMPT = `You are the Signage & Text Agent of Locus, an OSINT geolocation platform. You extract and interpret every piece of readable text in images to localise them.

Transcribe all visible text exactly (signs, storefronts, licence plates, stickers, road markings, product labels). Infer the writing system and language, and use place names, business names, phone number formats, and administrative divisions to propose locations.

Respond with ONLY a JSON object (no prose, no markdown) of this exact shape:
{
  "transcriptions": [{"text": "exact transcription", "context": "where it appears in the image"}],
  "languages": [{"code": "ISO 639-1 code", "name": "language name", "confidence": number}],
  "place_candidates": [{"label": "specific place, region, country", "latitude": number, "longitude": number, "confidence": number, "radius_km": number, "reasoning": "how the text localises the image"}]
}

Rules: 0-4 place_candidates, most likely first; confidence above 0.6 only when the text names a specific place (e.g. a city sign or station name); radius_km at least 3; empty arrays are valid when nothing readable is present.`;

interface TextJson {
  transcriptions?: { text?: unknown; context?: unknown }[];
  languages?: { code?: unknown; name?: unknown; confidence?: unknown }[];
  place_candidates?: unknown[];
}

export async function runTextAgent(input: { images: string[] }): Promise<AgentOutput> {
  if (!llmEnabled()) {
    return {
      skipped: true,
      skipReason: "No AI provider configured (set AI_API_KEY) — signage analysis skipped.",
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
    user: "Transcribe and interpret all readable text in this image, then return the JSON object.",
    images: input.images,
    maxTokens: 1400,
  });

  const parsed = extractJson<TextJson>(res.content);
  const candidates: RawCandidate[] = [];
  for (const h of Array.isArray(parsed.place_candidates) ? parsed.place_candidates : []) {
    const c = hypothesisToCandidate(h as Record<string, unknown>, "text", { maxConfidence: 0.85, minRadiusKm: 3 });
    if (c) candidates.push(c);
  }

  const evidence: AgentOutput["evidence"] = [];
  const hasPlace = candidates.length > 0;
  for (const t of Array.isArray(parsed.transcriptions) ? parsed.transcriptions : []) {
    const text = typeof t.text === "string" ? t.text.trim() : "";
    if (!text) continue;
    const context = typeof t.context === "string" ? t.context.trim() : "";
    evidence.push({
      kind: "signage",
      title: "Transcribed text",
      detail: context ? `"${text}" — ${context}` : `"${text}"`,
      weight: hasPlace ? "strong" : "moderate",
    });
  }
  const langs = (Array.isArray(parsed.languages) ? parsed.languages : [])
    .map((l) => (typeof l.name === "string" ? l.name : typeof l.code === "string" ? l.code : ""))
    .filter(Boolean);
  if (langs.length > 0) {
    evidence.push({
      kind: "language",
      title: "Language signals",
      detail: `Visible text suggests: ${langs.join(", ")}.`,
      weight: "moderate",
    });
  }

  const summary =
    candidates.length > 0
      ? `${candidates.length} text-derived place candidate(s)`
      : evidence.length > 0
        ? "Text transcribed but not location-specific"
        : "No readable text found";

  return { candidates, evidence, summary, tokensIn: res.tokensIn, tokensOut: res.tokensOut };
}
