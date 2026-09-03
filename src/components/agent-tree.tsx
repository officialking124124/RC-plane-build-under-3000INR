"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Layers,
  Loader2,
  MinusCircle,
  Workflow,
  XCircle,
} from "lucide-react";
import type { BranchStatus, JobEvent } from "@/lib/engine/types";

interface BranchState {
  id: string;
  label: string;
  status: BranchStatus;
  message?: string;
  tokensIn?: number;
  tokensOut?: number;
  durationMs?: number;
}

interface ForkState {
  id: string;
  label: string;
  branches: BranchState[];
}

function StatusIcon({ status }: { status: BranchStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />;
    case "processing":
      return <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-cyan-400" />;
    case "failed":
      return <XCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />;
    case "skipped":
      return <MinusCircle size={16} className="mt-0.5 shrink-0 text-amber-400" />;
    default:
      return <CircleDashed size={16} className="mt-0.5 shrink-0 text-slate-500" />;
  }
}

function fmtTokens(n?: number): string {
  if (!n) return "";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

function BranchRow({ branch }: { branch: BranchState }) {
  return (
    <li className="animate-fade-up flex items-start justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-900/30 p-3">
      <div className="min-w-0">
        <StatusIcon status={branch.status} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">{branch.label}</div>
        {branch.message && <p className="mt-1 break-words text-xs leading-relaxed text-slate-400">{branch.message}</p>}
      </div>
      <div className="shrink-0 text-right text-[10px] leading-4 text-slate-500">
        {branch.durationMs !== undefined && <div>{(branch.durationMs / 1000).toFixed(1)}s</div>}
        {(branch.tokensIn || branch.tokensOut) && (
          <div className="font-mono">
            {fmtTokens(branch.tokensIn)}&rarr;{fmtTokens(branch.tokensOut)} tok
          </div>
        )}
      </div>
    </li>
  );
}

export function AgentTree({ events }: { events: JobEvent[] }) {
  const { forks, orphans } = useMemo(() => {
    const forkById = new Map<string, ForkState>();
    const forkOf = new Map<string, string>();
    const branchById = new Map<string, BranchState>();

    for (const event of events) {
      if (event.type === "branch_point") {
        const fork: ForkState = { id: event.forkId, label: event.forkLabel, branches: [] };
        forkById.set(event.forkId, fork);
        for (const b of event.branches) {
          forkOf.set(b.id, event.forkId);
          const state: BranchState = { ...b };
          branchById.set(b.id, state);
          fork.branches.push(state);
        }
      } else if (event.type === "branch_update") {
        const updated: BranchState = {
          id: event.branchId,
          label: event.label,
          status: event.status,
          message: event.message,
          tokensIn: event.tokensIn,
          tokensOut: event.tokensOut,
          durationMs: event.durationMs,
        };
        const existing = branchById.get(event.branchId);
        if (existing) {
          Object.assign(existing, updated);
        } else {
          branchById.set(event.branchId, updated);
          const forkId = forkOf.get(event.branchId);
          const fork = forkId ? forkById.get(forkId) : undefined;
          if (fork) fork.branches.push(updated);
        }
      }
    }

    return {
      forks: [...forkById.values()],
      orphans: [...branchById.values()].filter((b) => !forkOf.has(b.id)),
    };
  }, [events]);

  return (
    <div className="space-y-4">
      {forks.map((fork) => (
        <section key={fork.id} className="card p-4">
          <h2 className="flex items-center gap-2 px-1 pb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <Layers size={14} className="text-cyan-400" />
            {fork.label}
          </h2>
          <ul className="space-y-2">
            {fork.branches.map((b) => (
              <BranchRow key={b.id} branch={b} />
            ))}
          </ul>
        </section>
      ))}
      {orphans.length > 0 && (
        <section className="card p-4">
          <h2 className="flex items-center gap-2 px-1 pb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <Workflow size={14} className="text-cyan-400" />
            Pipeline
          </h2>
          <ul className="space-y-2">
            {orphans.map((b) => (
              <BranchRow key={b.id} branch={b} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
