import type { AgentId, Candidate, Evidence, RawCandidate } from "./types";

// Reliability of each evidence source; fused confidence is a noisy-OR over these.
const SOURCE_WEIGHT: Record<AgentId, number> = {
  exif: 0.97,
  scene: 0.82,
  vision: 0.82,
  text: 0.74,
  search: 0.55,
  fusion: 0,
};

const CLUSTER_KM = 30;
const MAX_CANDIDATES = 5;

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface Cluster {
  members: RawCandidate[];
  missProb: number;
}

/**
 * Deterministic fusion: clusters candidates by geographic proximity, combines
 * confidences per source reliability (noisy-OR), and flags agent disagreement.
 */
export function fuse(input: { candidates: RawCandidate[]; evidence: Evidence[] }): {
  candidates: Candidate[];
  disagreement: boolean;
} {
  const valid = input.candidates.filter(
    (c) =>
      Number.isFinite(c.latitude) &&
      Number.isFinite(c.longitude) &&
      Math.abs(c.latitude) <= 90 &&
      Math.abs(c.longitude) <= 180 &&
      Number.isFinite(c.confidence),
  );
  const ranked = [...valid].sort(
    (a, b) => (SOURCE_WEIGHT[b.source] ?? 0.5) * b.confidence - (SOURCE_WEIGHT[a.source] ?? 0.5) * a.confidence,
  );

  const clusters: Cluster[] = [];
  for (const candidate of ranked) {
    const p = Math.min(0.96, (SOURCE_WEIGHT[candidate.source] ?? 0.5) * candidate.confidence);
    const cluster = clusters.find((cl) => haversineKm(cl.members[0], candidate) < CLUSTER_KM);
    if (cluster) {
      cluster.members.push(candidate);
      cluster.missProb *= 1 - p;
    } else {
      clusters.push({ members: [candidate], missProb: 1 - p });
    }
  }

  const out = clusters
    .map((cluster): Candidate => {
      const confidence = Math.min(0.98, 1 - cluster.missProb);
      const sources = [...new Set(cluster.members.map((m) => m.source))];
      const best = [...cluster.members].sort(
        (a, b) => (SOURCE_WEIGHT[b.source] ?? 0.5) * b.confidence - (SOURCE_WEIGHT[a.source] ?? 0.5) * a.confidence,
      )[0];
      const latAvg = cluster.members.reduce((s, m) => s + m.latitude, 0) / cluster.members.length;
      const lonAvg = cluster.members.reduce((s, m) => s + m.longitude, 0) / cluster.members.length;
      const tightest = Math.min(...cluster.members.map((m) => m.radiusKm));
      const radiusKm = cluster.members.length > 1 ? Math.max(0.25, tightest * 0.6) : best.radiusKm;
      const evidenceIds = input.evidence.filter((e) => sources.includes(e.agent)).map((e) => e.id);
      return {
        id: "c",
        label: best.label,
        latitude: Math.round(latAvg * 10000) / 10000,
        longitude: Math.round(lonAvg * 10000) / 10000,
        confidence: Math.round(confidence * 1000) / 1000,
        radiusKm: Math.round(radiusKm * 100) / 100,
        reasoning: cluster.members.map((m) => `[${m.source}] ${m.reasoning}`).join("  "),
        sources,
        fused: cluster.members.length > 1,
        evidenceIds,
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_CANDIDATES)
    .map((c, i) => ({ ...c, id: `c${i + 1}` }));

  const disagreement =
    out.length >= 2 &&
    out[1].confidence > 0.3 &&
    out[0].confidence < 0.9 &&
    haversineKm(out[0], out[1]) > 300;

  return { candidates: out, disagreement };
}
