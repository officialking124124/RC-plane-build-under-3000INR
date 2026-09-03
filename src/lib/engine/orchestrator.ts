import { analyzeExif } from "./agents/exif";
import { runSceneAgent } from "./agents/scene";
import { runSearchAgent } from "./agents/search";
import { runTextAgent } from "./agents/text";
import { runVisionAgent } from "./agents/vision";
import { fuse } from "./fusion";
import { llmEnabled } from "./llm";
import * as store from "./store";
import type {
  AgentId,
  AgentOutput,
  AgentStat,
  AnalysisResult,
  Candidate,
  Evidence,
  Job,
  RawCandidate,
} from "./types";

interface Accumulator {
  candidates: RawCandidate[];
  evidence: Evidence[];
  stats: AgentStat[];
  prelimCount: number;
}

function preliminaryCandidate(raw: RawCandidate, index: number): Candidate {
  return {
    id: `p${index}`,
    label: raw.label,
    latitude: raw.latitude,
    longitude: raw.longitude,
    confidence: raw.confidence,
    radiusKm: raw.radiusKm,
    reasoning: raw.reasoning,
    sources: [raw.source],
    fused: false,
    evidenceIds: [],
  };
}

async function runAgent(
  jobId: string,
  id: AgentId,
  label: string,
  fn: () => Promise<AgentOutput>,
  acc: Accumulator,
): Promise<void> {
  store.emitBranchUpdate(jobId, id, label, "processing", "Starting");
  const started = Date.now();
  try {
    const out = await fn();
    const durationMs = Date.now() - started;
    const status = out.skipped ? "skipped" : "completed";
    store.emitBranchUpdate(jobId, id, label, status, out.skipped ? out.skipReason : out.summary, {
      durationMs,
      tokensIn: out.tokensIn,
      tokensOut: out.tokensOut,
    });
    acc.stats.push({ agent: id, status, durationMs, tokensIn: out.tokensIn, tokensOut: out.tokensOut, message: out.summary });

    acc.candidates.push(...out.candidates);
    for (const e of out.evidence) {
      const evidence: Evidence = { id: `e${acc.evidence.length + 1}`, agent: id, ...e };
      acc.evidence.push(evidence);
      store.emitEvidence(jobId, evidence);
    }
    for (const c of out.candidates) {
      acc.prelimCount += 1;
      store.emitCandidate(jobId, preliminaryCandidate(c, acc.prelimCount), true);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - started;
    store.emitBranchUpdate(jobId, id, label, "failed", message, { durationMs });
    acc.stats.push({ agent: id, status: "failed", durationMs, message });
  }
}

export function startJob(jobId: string): void {
  void runJob(jobId);
}

async function runJob(jobId: string): Promise<void> {
  const job: Job | null = store.getJob(jobId);
  if (!job || job.status !== "pending") return;
  job.status = "running";
  const started = Date.now();
  const acc: Accumulator = { candidates: [], evidence: [], stats: [], prelimCount: 0 };
  const notes: string[] = [];
  const images = job.files.map((f) => f.dataUrl);

  try {
    store.emitProcessing(
      jobId,
      `Job accepted — mode "${job.mode}"${job.files.length ? `, ${job.files.length} file(s)` : ""}.`,
    );

    if (job.mode === "event") {
      store.emitBranchPoint(jobId, "fork-event", "Analysis branches", [
        { id: "search", label: "Knowledge Search Agent" },
      ]);
      await runAgent(
        jobId,
        "search",
        "Knowledge Search Agent",
        () => runSearchAgent({ description: job.description, priorSummaries: [] }),
        acc,
      );
    } else {
      const branches: { id: AgentId; label: string }[] = [{ id: "exif", label: "EXIF Forensics" }];
      if (job.mode === "fast") branches.push({ id: "vision", label: "Vision Agent" });
      else branches.push({ id: "scene", label: "Scene Analysis Agent" }, { id: "text", label: "Signage & Text Agent" });
      store.emitBranchPoint(jobId, "fork-parallel", "Parallel analysis", branches);

      await runAgent(
        jobId,
        "exif",
        "EXIF Forensics",
        async () => {
          const outputs = job.files.map((f) =>
            analyzeExif({ name: f.name, buffer: Buffer.from(f.dataUrl.split(",")[1] ?? "", "base64") }),
          );
          return {
            candidates: outputs.flatMap((o) => o.candidates),
            evidence: outputs.flatMap((o) => o.evidence),
            summary: outputs.map((o) => o.summary).join("; ") || "No files to inspect",
          };
        },
        acc,
      );

      if (job.mode === "fast") {
        await runAgent(jobId, "vision", "Vision Agent", () => runVisionAgent({ images }), acc);
      } else {
        await Promise.all([
          runAgent(jobId, "scene", "Scene Analysis Agent", () => runSceneAgent({ images }), acc),
          runAgent(jobId, "text", "Signage & Text Agent", () => runTextAgent({ images }), acc),
        ]);
        store.emitBranchPoint(jobId, "fork-refine", "Refinement", [
          { id: "search", label: "Knowledge Search Agent" },
        ]);
        await runAgent(
          jobId,
          "search",
          "Knowledge Search Agent",
          () =>
            runSearchAgent({
              description: job.description,
              priorSummaries: acc.stats
                .filter((s) => s.agent === "scene" || s.agent === "text" || s.agent === "vision")
                .map((s) => ({ agent: s.agent, summary: s.message ?? "" })),
            }),
          acc,
        );
      }
    }

    store.emitBranchUpdate(jobId, "fusion", "Fusion Engine", "processing", "Clustering and calibrating candidates");
    const fusionStart = Date.now();
    const fused = fuse({ candidates: acc.candidates, evidence: acc.evidence });
    const fusionDuration = Date.now() - fusionStart;
    store.emitBranchUpdate(
      jobId,
      "fusion",
      "Fusion Engine",
      "completed",
      `${fused.candidates.length} fused location(s)${fused.disagreement ? " — agents disagree" : ""}`,
      { durationMs: fusionDuration },
    );
    acc.stats.push({
      agent: "fusion",
      status: "completed",
      durationMs: fusionDuration,
      message: `${fused.candidates.length} fused location(s)`,
    });
    for (const c of fused.candidates) store.emitCandidate(jobId, c, false);

    if (!llmEnabled() && job.mode !== "event") {
      notes.push(
        "No AI provider configured — set AI_API_KEY to enable vision and knowledge agents. Only EXIF forensics produced evidence.",
      );
    }
    if (job.mode === "event" && !llmEnabled()) {
      notes.push("Event mode requires an AI provider (set AI_API_KEY).");
    }
    if (fused.candidates.length === 0) {
      notes.push("No location hypotheses could be produced from this input.");
    }

    const result: AnalysisResult = {
      status: fused.candidates.length > 0 ? "success" : "partial",
      locations: fused.candidates,
      evidence: acc.evidence,
      disagreement: fused.disagreement,
      processingTimeMs: Date.now() - started,
      agentStats: acc.stats,
      requestsRemaining: job.requestsRemaining ?? null,
      notes,
    };
    job.result = result;
    store.emitCompleted(jobId, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.emitError(jobId, message);
  }
}
