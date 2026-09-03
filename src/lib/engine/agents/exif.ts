import ExifReader from "exifreader";
import type { AgentOutput, RawCandidate } from "../types";

interface AnyTag {
  value?: unknown;
  description?: string;
}

interface TagGroups {
  gps?: Record<string, unknown>;
  exif?: Record<string, AnyTag>;
  ifd0?: Record<string, AnyTag>;
}

// The expanded gps group stores Latitude/Longitude/Altitude as raw numbers,
// while exif/ifd0 groups store tag objects with .value/.description.
function num(tag: unknown): number | null {
  if (typeof tag === "number" && Number.isFinite(tag)) return tag;
  if (tag && typeof tag === "object") {
    const t = tag as AnyTag;
    if (typeof t.value === "number" && Number.isFinite(t.value)) return t.value;
    if (typeof t.description === "string") {
      const parsed = Number.parseFloat(t.description);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function str(tag: AnyTag | undefined): string | null {
  if (!tag) return null;
  if (typeof tag.description === "string" && tag.description.trim()) return tag.description.trim();
  if (typeof tag.value === "string") return tag.value;
  return null;
}

function coordLabel(value: number, positive: string, negative: string): string {
  const hemi = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(4)}\u00b0 ${hemi}`;
}

/** Deterministic EXIF forensics: device GPS, capture time, and camera fingerprints. No LLM required. */
export function analyzeExif(file: { name: string; buffer: Buffer }): AgentOutput {
  const evidence: AgentOutput["evidence"] = [];
  const candidates: RawCandidate[] = [];
  let summary = "No EXIF data found";

  try {
    const tags = ExifReader.load(file.buffer, { expanded: true }) as unknown as TagGroups;
    const latitude = num(tags.gps?.Latitude);
    const longitude = num(tags.gps?.Longitude);
    const altitude = num(tags.gps?.Altitude);
    const make = str(tags.ifd0?.Make);
    const model = str(tags.ifd0?.Model);
    const captured = str(tags.exif?.DateTimeOriginal);

    summary = "No EXIF GPS coordinates present";
    if (
      latitude !== null &&
      longitude !== null &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180 &&
      (latitude !== 0 || longitude !== 0)
    ) {
      candidates.push({
        label: `${coordLabel(latitude, "N", "S")} ${coordLabel(longitude, "E", "W")} (EXIF GPS)`,
        latitude,
        longitude,
        confidence: 0.98,
        radiusKm: 0.25,
        reasoning: `EXIF metadata embeds device-recorded GPS coordinates${
          model ? ` (captured with ${[make, model].filter(Boolean).join(" ")})` : ""
        }. Device GPS is typically accurate to within a few hundred metres, so this is treated as near-certain unless contradicted.`,
        source: "exif",
      });
      evidence.push({
        kind: "exif-gps",
        title: "EXIF GPS coordinates",
        detail: `Latitude ${latitude}, longitude ${longitude}${
          altitude !== null ? `, altitude ${altitude} m` : ""
        }${captured ? `; captured ${captured}` : ""}.`,
        weight: "strong",
      });
      summary = `EXIF GPS found: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } else {
      evidence.push({
        kind: "exif-none",
        title: "No EXIF GPS",
        detail: `${file.name}: no embedded GPS coordinates (metadata stripped or never recorded).`,
        weight: "weak",
      });
    }

    const device = [make, model].filter(Boolean).join(" ");
    if (device || captured) {
      evidence.push({
        kind: "exif-device",
        title: "Capture metadata",
        detail: [device, captured].filter(Boolean).join(" \u00b7 "),
        weight: "weak",
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    evidence.push({ kind: "exif-error", title: "EXIF parse failed", detail: `${file.name}: ${message}`, weight: "weak" });
    summary = `EXIF parsing failed for ${file.name}`;
  }

  return { candidates, evidence, summary };
}
