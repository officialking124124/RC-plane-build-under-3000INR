"use client";

import { useState } from "react";
import { Check, Copy, ListOrdered, TriangleAlert } from "lucide-react";
import { EvidenceList } from "@/components/evidence-list";
import type { AnalysisResult } from "@/lib/engine/types";

function confColor(c: number): string {
  return c >= 0.8 ? "bg-emerald-400" : c >= 0.5 ? "bg-amber-400" : "bg-rose-400";
}

export function ResultView({ result }: { result: AnalysisResult }) {
  const [copied, setCopied] = useState(false);

  async function copyJson() {
    const payload = {
      status: result.status,
      locations: result.locations.map((l) => ({
        latitude: l.latitude,
        longitude: l.longitude,
        address: l.label,
        confidence: l.confidence,
        radius_km: l.radiusKm,
        reasoning: l.reasoning,
      })),
      processing_time: `${(result.processingTimeMs / 1000).toFixed(1)}s`,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="space-y-4">
      {result.notes.length > 0 && (
        <div className="card border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
          <div className="flex items-center gap-2 font-medium text-amber-200">
            <TriangleAlert size={15} /> Notes
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {result.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <ListOrdered size={15} className="text-cyan-400" />
            Location hypotheses
            <span className="text-slate-500">({result.locations.length})</span>
          </h2>
          <button
            type="button"
            onClick={copyJson}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-500/60"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>

        {result.locations.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            No location hypotheses were produced. Check the notes above and the agent tree for why — e.g. no AI provider
            configured and no EXIF GPS in the upload.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {result.locations.map((c, i) => (
              <li key={c.id} className="animate-fade-up rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-cyan-400/15 text-[11px] font-bold text-cyan-300">
                        {i + 1}
                      </span>
                      <h3 className="font-medium text-slate-100">{c.label}</h3>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)} &middot; &plusmn; {c.radiusKm} km
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-slate-200">{Math.round(c.confidence * 100)}%</div>
                    {c.fused && <div className="text-[10px] uppercase tracking-wide text-cyan-400">fused</div>}
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${confColor(c.confidence)}`}
                    style={{ width: `${Math.round(c.confidence * 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{c.reasoning}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.sources.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-slate-700/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <EvidenceList evidence={result.evidence} />

      <section className="card p-5">
        <h2 className="text-sm font-medium text-slate-300">Agent statistics</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2 pr-4 font-medium">Agent</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Duration</th>
                <th className="pb-2 font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {result.agentStats.map((s, i) => (
                <tr key={i} className="border-t border-slate-800/70">
                  <td className="py-2 pr-4 font-mono">{s.agent}</td>
                  <td className="py-2 pr-4">{s.status}</td>
                  <td className="py-2 pr-4">{s.durationMs !== undefined ? `${(s.durationMs / 1000).toFixed(1)}s` : "—"}</td>
                  <td className="py-2 font-mono">
                    {s.tokensIn || s.tokensOut ? `${s.tokensIn ?? 0} → ${s.tokensOut ?? 0}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
