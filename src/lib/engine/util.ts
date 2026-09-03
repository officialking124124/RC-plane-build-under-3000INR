import type { AgentId, RawCandidate } from "./types";

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Normalises one LLM hypothesis object into a RawCandidate, or null if unusable. */
export function hypothesisToCandidate(
  h: Record<string, unknown>,
  source: AgentId,
  defaults: { maxConfidence: number; minRadiusKm: number },
): RawCandidate | null {
  const latitude = typeof h.latitude === "number" ? h.latitude : Number.NaN;
  const longitude = typeof h.longitude === "number" ? h.longitude : Number.NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const label =
    typeof h.label === "string" && h.label.trim() ? h.label.trim() : `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
  const rawConfidence = typeof h.confidence === "number" && Number.isFinite(h.confidence) ? h.confidence : 0.25;
  const rawRadius = typeof h.radius_km === "number" ? h.radius_km : typeof h.radiusKm === "number" ? h.radiusKm : 50;
  const radiusKm = Number.isFinite(rawRadius) ? clamp(rawRadius, defaults.minRadiusKm, 5000) : defaults.minRadiusKm;
  const reasoning = typeof h.reasoning === "string" && h.reasoning.trim() ? h.reasoning.trim() : "No reasoning provided.";

  return {
    label,
    latitude,
    longitude,
    confidence: clamp(rawConfidence, 0.01, defaults.maxConfidence),
    radiusKm,
    reasoning,
    source,
  };
}
