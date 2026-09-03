import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fuse, haversineKm } from "@/lib/engine/fusion";
import type { RawCandidate } from "@/lib/engine/types";

const cand = (over: Partial<RawCandidate>): RawCandidate => ({
  label: "somewhere",
  latitude: 0,
  longitude: 0,
  confidence: 0.5,
  radiusKm: 50,
  reasoning: "r",
  source: "scene",
  ...over,
});

describe("haversineKm", () => {
  it("measures a known distance", () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const lyon = { latitude: 45.764, longitude: 4.8357 };
    expect(haversineKm(paris, lyon)).toBeGreaterThan(380);
    expect(haversineKm(paris, lyon)).toBeLessThan(400);
  });
});

describe("fuse", () => {
  it("merges corroborating candidates and raises confidence", () => {
    const fused = fuse({
      candidates: [
        cand({ source: "exif", latitude: 48.8584, longitude: 2.2945, confidence: 0.98, radiusKm: 0.25, label: "EXIF GPS" }),
        cand({ source: "scene", latitude: 48.858, longitude: 2.294, confidence: 0.8, radiusKm: 3, label: "Eiffel Tower, Paris, France" }),
      ],
      evidence: [],
    });
    expect(fused.candidates).toHaveLength(1);
    expect(fused.candidates[0].sources).toEqual(expect.arrayContaining(["exif", "scene"]));
    expect(fused.candidates[0].confidence).toBeGreaterThan(0.8);
    expect(fused.candidates[0].fused).toBe(true);
  });

  it("keeps distant hypotheses apart and flags disagreement", () => {
    const fused = fuse({
      candidates: [
        cand({ source: "scene", latitude: 48.85, longitude: 2.35, confidence: 0.7, label: "Paris, France" }),
        cand({ source: "text", latitude: 35.68, longitude: 139.76, confidence: 0.6, label: "Tokyo, Japan" }),
      ],
      evidence: [],
    });
    expect(fused.candidates).toHaveLength(2);
    expect(fused.disagreement).toBe(true);
  });

  it("does not flag disagreement when EXIF dominates", () => {
    const fused = fuse({
      candidates: [
        cand({ source: "exif", latitude: 48.8584, longitude: 2.2945, confidence: 0.98 }),
        cand({ source: "search", latitude: 35.68, longitude: 139.76, confidence: 0.55, label: "Tokyo, Japan" }),
      ],
      evidence: [],
    });
    expect(fused.disagreement).toBe(false);
  });

  it("drops invalid coordinates", () => {
    const fused = fuse({ candidates: [cand({ latitude: 120, longitude: 999 })], evidence: [] });
    expect(fused.candidates).toHaveLength(0);
  });
});
