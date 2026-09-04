import * as fs from "node:fs";
import * as path from "node:path";
import type { AnalysisResult, BranchStatus, Candidate, Evidence, FileMeta, Job, JobEvent, JobMode } from "./types";

type Subscriber = (event: JobEvent) => void;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type EventInput = DistributiveOmit<JobEvent, "seq" | "ts">;

const MAX_JOBS = 200;
const PERSIST_DIR = path.join(process.cwd(), ".data", "jobs");
// Job ids are server-generated; refuse anything else before it reaches the filesystem.
const JOB_ID_RE = /^job_[a-f0-9]{12}$/;

const jobs = new Map<string, Job>();
const subscribers = new Map<string, Set<Subscriber>>();

function jobFile(id: string): string {
  return path.join(PERSIST_DIR, `${id}.json`);
}

function persist(job: Job): void {
  try {
    fs.mkdirSync(PERSIST_DIR, { recursive: true });
    // Image payloads are dropped: they can be megabytes and are never needed after the run.
    const slim: Job = { ...job, files: job.files.map((f) => ({ ...f, dataUrl: "" })) };
    const tmp = `${jobFile(job.id)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(slim));
    fs.renameSync(tmp, jobFile(job.id));
  } catch {
    // Best-effort durability: analysis works in memory even when the disk write fails.
  }
}

function hydrate(id: string): Job | null {
  if (!JOB_ID_RE.test(id)) return null;
  try {
    const job = JSON.parse(fs.readFileSync(jobFile(id), "utf8")) as Job;
    if (job.id !== id) return null;
    if (job.status === "pending" || job.status === "running") {
      // The process that owned this job is gone; close it out instead of leaving the client hanging.
      job.status = "failed";
      job.events.push({
        type: "error",
        message: "Analysis was interrupted by a server restart before completion. Run the analysis again.",
        seq: job.events.length + 1,
        ts: Date.now(),
      } as JobEvent);
      persist(job);
    }
    jobs.set(id, job);
    return job;
  } catch {
    return null;
  }
}

function push(jobId: string, input: EventInput): JobEvent {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`unknown job: ${jobId}`);
  const event = { ...input, seq: job.events.length + 1, ts: Date.now() } as JobEvent;
  job.events.push(event);
  if (event.type === "completed") job.status = "completed";
  else if (event.type === "error") job.status = "failed";
  persist(job);
  for (const sub of subscribers.get(jobId) ?? []) sub(event);
  return event;
}

export function createJob(input: {
  mode: JobMode;
  description?: string;
  files: FileMeta[];
  requestsRemaining?: number | null;
}): Job {
  const id = `job_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const job: Job = { id, status: "pending", events: [], result: null, createdAt: Date.now(), ...input };
  jobs.set(id, job);
  persist(job);
  while (jobs.size > MAX_JOBS) {
    const oldest = jobs.keys().next().value;
    if (oldest === undefined || oldest === id) break;
    jobs.delete(oldest);
    subscribers.delete(oldest);
    try {
      fs.rmSync(jobFile(oldest), { force: true });
    } catch {
      // eviction is advisory; a stray file is harmless
    }
  }
  return job;
}

export function getJob(id: string): Job | null {
  return jobs.get(id) ?? hydrate(id);
}

export function subscribe(jobId: string, sub: Subscriber): () => void {
  const set = subscribers.get(jobId) ?? new Set<Subscriber>();
  subscribers.set(jobId, set);
  set.add(sub);
  return () => {
    set.delete(sub);
  };
}

export const emitProcessing = (jobId: string, message: string): void => {
  push(jobId, { type: "processing", message });
};

export const emitBranchPoint = (
  jobId: string,
  forkId: string,
  forkLabel: string,
  branches: { id: string; label: string }[],
): void => {
  push(jobId, {
    type: "branch_point",
    forkId,
    forkLabel,
    branches: branches.map((b) => ({ ...b, status: "queued" as BranchStatus })),
  });
};

export const emitBranchUpdate = (
  jobId: string,
  branchId: string,
  label: string,
  status: BranchStatus,
  message?: string,
  extra?: { tokensIn?: number; tokensOut?: number; durationMs?: number },
): void => {
  push(jobId, { type: "branch_update", branchId, label, status, message, ...extra });
};

export const emitEvidence = (jobId: string, evidence: Evidence): void => {
  push(jobId, { type: "evidence", evidence });
};

export const emitCandidate = (jobId: string, candidate: Candidate, preliminary: boolean): void => {
  push(jobId, { type: "candidate", candidate, preliminary });
};

export const emitCompleted = (jobId: string, result: AnalysisResult): void => {
  push(jobId, { type: "completed", result });
};

export const emitError = (jobId: string, message: string): void => {
  push(jobId, { type: "error", message });
};
