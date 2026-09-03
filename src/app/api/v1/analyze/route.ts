import { NextRequest, NextResponse } from "next/server";
import { consumeQuota, resolveKey } from "@/lib/api/keys";
import { startJob } from "@/lib/engine/orchestrator";
import { createJob } from "@/lib/engine/store";
import type { FileMeta, JobMode } from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function fail(status: number, error: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ status: "error", error, message, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  let requestsRemaining: number | null = null;
  if (apiKey) {
    const record = await resolveKey(apiKey);
    if (!record) {
      return fail(401, "invalid_api_key", "Unknown X-API-Key. Create one at /docs.");
    }
    const quota = await consumeQuota(apiKey);
    if (!quota.ok) {
      return fail(429, "quota_exceeded", `Quota exhausted for this key (${record.quota} requests).`, {
        API_Requests_remaining: 0,
      });
    }
    requestsRemaining = quota.remaining;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "invalid_form", "Expected multipart/form-data with files and mode fields.");
  }

  const modeRaw = String(form.get("mode") ?? "fast");
  if (modeRaw !== "fast" && modeRaw !== "agent" && modeRaw !== "event") {
    return fail(400, "invalid_mode", 'mode must be one of "fast", "agent", or "event".');
  }
  const mode = modeRaw as JobMode;

  const description = typeof form.get("description") === "string" ? String(form.get("description") ?? "").trim() : "";
  if (mode === "event" && description.length < 20) {
    return fail(400, "short_description", "Event mode requires a description of at least 20 characters.");
  }

  const files = [...form.getAll("files"), ...form.getAll("file")].filter(
    (v): v is File => v instanceof File && v.size > 0,
  );

  if (mode !== "event") {
    if (files.length === 0) {
      return fail(400, "no_files", "Attach at least one image (form fields: files or file).");
    }
    if (files.length > MAX_FILES) {
      return fail(400, "too_many_files", `Up to ${MAX_FILES} images per analysis.`);
    }
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      return fail(400, "too_large", "Total upload size must stay under 10 MB.");
    }
    for (const f of files) {
      if (!ALLOWED_MIME.has(f.type)) {
        if (f.type.startsWith("video/")) {
          return fail(
            415,
            "unsupported_media",
            `Video analysis is not available yet (got ${f.type}). Export key frames as images.`,
            { API_Requests_remaining: requestsRemaining ?? undefined },
          );
        }
        return fail(400, "unsupported_media", `Unsupported file type ${f.type || "(unknown)"}. Allowed: JPEG, PNG, WebP, HEIC.`);
      }
    }
  }

  const metas: FileMeta[] = [];
  for (const f of files) {
    const base64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    metas.push({ name: f.name || "upload", mime: f.type, size: f.size, dataUrl: `data:${f.type};base64,${base64}` });
  }

  const job = createJob({ mode, description: description || undefined, files: metas, requestsRemaining });
  startJob(job.id);

  return NextResponse.json(
    {
      status: "accepted",
      job_id: job.id,
      mode,
      events_url: `/api/v1/jobs/${job.id}/events`,
      status_url: `/api/v1/jobs/${job.id}`,
      API_Requests_remaining: requestsRemaining ?? "unlimited",
    },
    { status: 202 },
  );
}
