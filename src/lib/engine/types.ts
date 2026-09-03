export type AgentId = "exif" | "scene" | "text" | "search" | "vision" | "fusion";

export type JobMode = "fast" | "agent" | "event";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export type BranchStatus = "queued" | "processing" | "completed" | "failed" | "skipped";

export type EvidenceWeight = "strong" | "moderate" | "weak";

export interface FileMeta {
  name: string;
  mime: string;
  size: number;
  dataUrl: string;
}

export interface RawCandidate {
  label: string;
  latitude: number;
  longitude: number;
  confidence: number;
  radiusKm: number;
  reasoning: string;
  source: AgentId;
}

export interface Candidate {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  confidence: number;
  radiusKm: number;
  reasoning: string;
  sources: AgentId[];
  fused: boolean;
  evidenceIds: string[];
}

export interface Evidence {
  id: string;
  agent: AgentId;
  kind: string;
  title: string;
  detail: string;
  weight: EvidenceWeight;
}

export interface EvidenceInput {
  kind: string;
  title: string;
  detail: string;
  weight: EvidenceWeight;
}

export interface AgentOutput {
  skipped?: boolean;
  skipReason?: string;
  candidates: RawCandidate[];
  evidence: EvidenceInput[];
  summary: string;
  tokensIn?: number;
  tokensOut?: number;
}

export interface AgentStat {
  agent: AgentId;
  status: BranchStatus;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  message?: string;
}

export interface AnalysisResult {
  status: "success" | "partial";
  locations: Candidate[];
  evidence: Evidence[];
  disagreement: boolean;
  processingTimeMs: number;
  agentStats: AgentStat[];
  requestsRemaining: number | null;
  notes: string[];
}

export type JobEvent =
  | { seq: number; ts: number; type: "processing"; message: string }
  | { seq: number; ts: number; type: "branch_point"; forkId: string; forkLabel: string; branches: { id: string; label: string; status: BranchStatus }[] }
  | { seq: number; ts: number; type: "branch_update"; branchId: string; label: string; status: BranchStatus; message?: string; tokensIn?: number; tokensOut?: number; durationMs?: number }
  | { seq: number; ts: number; type: "evidence"; evidence: Evidence }
  | { seq: number; ts: number; type: "candidate"; candidate: Candidate; preliminary: boolean }
  | { seq: number; ts: number; type: "completed"; result: AnalysisResult }
  | { seq: number; ts: number; type: "error"; message: string };

export interface Job {
  id: string;
  mode: JobMode;
  status: JobStatus;
  description?: string;
  files: FileMeta[];
  events: JobEvent[];
  result: AnalysisResult | null;
  createdAt: number;
  requestsRemaining?: number | null;
}
