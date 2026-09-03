"use client";

import { Eye } from "lucide-react";
import type { Evidence } from "@/lib/engine/types";

const WEIGHT_COLOR: Record<Evidence["weight"], string> = {
  strong: "bg-emerald-400",
  moderate: "bg-amber-400",
  weak: "bg-slate-500",
};

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium text-slate-300">
        <Eye size={15} className="text-cyan-400" />
        Evidence trail
        <span className="text-slate-500">({evidence.length})</span>
      </h2>
      {evidence.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No evidence yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {evidence.map((e) => (
            <li key={e.id} className="animate-fade-up rounded-lg border border-slate-800 bg-slate-900/30 p-3">
              <div className="flex items-center gap-2 text-[13px] font-medium text-slate-200">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${WEIGHT_COLOR[e.weight]}`} />
                {e.title}
                <span className="ml-auto rounded border border-slate-700/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                  {e.agent}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{e.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
