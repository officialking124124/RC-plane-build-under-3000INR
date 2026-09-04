import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeExif } from "@/lib/engine/agents/exif";

describe("analyzeExif", () => {
  it("extracts GPS coordinates from the EXIF fixture", () => {
    const out = analyzeExif({ name: "has-exif.jpg", buffer: readFileSync("fixtures/has-exif.jpg") });
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].latitude).toBeCloseTo(48.8584, 3);
    expect(out.candidates[0].longitude).toBeCloseTo(2.2945, 3);
    expect(out.evidence.some((e) => e.kind === "exif-gps")).toBe(true);
  });

  it("handles missing EXIF gracefully", () => {
    const out = analyzeExif({ name: "no-exif.jpg", buffer: readFileSync("fixtures/no-exif.jpg") });
    expect(out.candidates).toHaveLength(0);
    expect(out.evidence.some((e) => e.kind === "exif-none")).toBe(true);
  });
});
