import { extractJson, llmChat, llmEnabled } from "../llm";
import type { AgentOutput, RawCandidate } from "../types";
import { hypothesisToCandidate } from "../util";

const SYSTEM_PROMPT = `You are the Scene Analysis Agent of Locus, an OSINT geolocation platform. You identify where photographs were taken using only visual evidence.

Analyse the attached image(s) for geographic evidence: architectural style and building materials, vegetation and biome, terrain, climate signals, road layout and markings, vehicles and licence plates, utility infrastructure (poles, wires, signage shapes), text and language, and any identifiable landmarks.

Respond with ONLY a JSON object (no prose, no markdown) of this exact shape:
{
  "scene_summary": "one short paragraph summarising the scene and its geographic signal",
  "clues": [{"category": "architecture|vegetation|terrain|infrastructure|language|vehicles|landmark|other", "observation": "what is visible", "significance": "where this pattern occurs geographically"}],
  "hypotheses": [{"label": "specific place or region, country", "latitude": number, "longitude": number, "confidence": number, "radius_km": number, "reasoning": "which clues support this"}]
}

Rules:
- Return 1 to 4 hypotheses, most likely first.
- confidence must reflect honest certainty: under 0.35 for continent/region level, 0.35-0.7 for country/area level, above 0.7 only when a specific landmark is visible.
- radius_km must match certainty: at least 200 for continent level, 25-150 for region level, 1-10 only for specific landmarks.
- Use precise coordinates for specific landmarks; approximate region centroids otherwise.`;

interface SceneJson {
  scene_summary?: unknown;
  clues?: { category?: unknown; observation?: unknown; significance?: unknown }[];
  hypotheses?: unknown[];
}

export async function runSceneAgent(input: { images: string[] }): Promise<AgentOutput> {
  if (!llmEnabled()) {
    return {
      skipped: true,
      skipReason: "No AI provider configured (set AI_API_KEY) — scene analysis skipped.",
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
    maxTokens: 1800,
  });

  const parsed = extractJson<SceneJson>(res.content);
  const candidates: RawCandidate[] = [];
  for (const h of Array.isArray(parsed.hypotheses) ? parsed.hypotheses : []) {
    const c = hypothesisToCandidate(h as Record<string, unknown>, "scene", { maxConfidence: 0.9, minRadiusKm: 1 });
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

  const summary =
    typeof parsed.scene_summary === "string" && parsed.scene_summary.trim()
      ? parsed.scene_summary.trim()
      : `${candidates.length} visual hypothesis(es)`;

  return { candidates, evidence, summary, tokensIn: res.tokensIn, tokensOut: res.tokensOut };
}
