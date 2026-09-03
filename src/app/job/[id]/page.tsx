"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamicImport from "next/dynamic";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, MapPin, TriangleAlert } from "lucide-react";
import { AgentTree } from "@/components/agent-tree";
import { EvidenceList } from "@/components/evidence-list";
import { ResultView } from "@/components/result-view";
import { updateHistoryEntry } from "@/lib/client/history";
import type { AnalysisResult, Candidate, Evidence, JobEvent } from "@/lib/engine/types";

const MapView = dynamicImport(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => <div className="card h-[340px] animate-pulse" />,
});

type Phase = "connecting" | "running" | "completed" | "failed" | "notfound";

const EVENT_TYPES = [
  "processing",
  "branch_point",
  "branch_update",
  "evidence",
  "candidate",
  "completed",
  "error",
];

export default function JobPage() {
  const params = useParams() as { id?: string | string[] };
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [events, setEvents] = useState<JobEvent[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/v1/jobs/${id}/events`);

    const onEvent = (raw: MessageEvent) => {
      let event: JobEvent;
      try {
        event = JSON.parse(String(raw.data)) as JobEvent;
      } catch {
        return;
      }
      setEvents((prev) => [...prev, event]);
      if (event.type === "completed") {
        doneRef.current = true;
        setResult(event.result);
        setPhase("completed");
        updateHistoryEntry(id, { topLabel: event.result.locations[0]?.label ?? "No location determined" });
        es.close();
      } else if (event.type === "error") {
        doneRef.current = true;
        setError(event.message);
        setPhase("failed");
        es.close();
      }
    };

    for (const type of EVENT_TYPES) es.addEventListener(type, onEvent);

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        es.close();
        if (!doneRef.current) {
          fetch(`/api/v1/jobs/${id}`)
            .then((r) => {
              if (r.status === 404) setPhase("notfound");
              else {
                setError("Event stream ended before completion. The job may have been lost to a server restart.");
                setPhase("failed");
              }
            })
            .catch(() => setPhase("failed"));
        }
      }
    };

    return () => es.close();
  }, [id]);

  const preliminary = useMemo(
    () =>
      events
        .filter((e): e is Extract<JobEvent, { type: "candidate" }> => e.type === "candidate" && e.preliminary)
        .map((e) => e.candidate),
    [events],
  );
  const liveEvidence = useMemo(
    () => events.filter((e): e is Extract<JobEvent, { type: "evidence" }> => e.type === "evidence").map((e) => e.evidence),
    [events],
  );

  const mapCandidates: Candidate[] = result?.locations ?? preliminary;
  const running = phase === "connecting" || phase === "running";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-cyan-300">
          <ArrowLeft size={15} /> New analysis
        </Link>
        <span className="text-slate-700">/</span>
        <span className="font-mono text-xs text-slate-500">{id}</span>
        <span className="ml-auto flex items-center gap-2 text-xs">
          {running && (
            <span className="flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-300">
              <Loader2 size={12} className="animate-spin" />
              {phase === "connecting" ? "connecting" : "agents running"}
            </span>
          )}
          {phase === "completed" && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
              completed in {(result ? result.processingTimeMs / 1000 : 0).toFixed(1)}s
            </span>
          )}
          {phase === "failed" && (
            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-rose-300">failed</span>
          )}
        </span>
      </div>

      {phase === "notfound" && (
        <div className="card mt-6 p-6 text-sm leading-relaxed text-slate-400">
          Job not found — the id is unknown or the job record was evicted after 200 newer analyses.
        </div>
      )}
      {error && (
        <div className="card mt-6 border-rose-500/25 bg-rose-500/5 p-4 text-sm text-rose-200">
          <div className="flex items-center gap-2 font-medium">
            <TriangleAlert size={15} /> Analysis error
          </div>
          <p className="mt-2 leading-relaxed">{error}</p>
        </div>
      )}

      {phase !== "notfound" && (
        <>
          {result?.disagreement && (
            <div className="card mt-6 border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-200">
              <div className="flex items-center gap-2 font-medium">
                <TriangleAlert size={15} /> Agents disagree
              </div>
              <p className="mt-1 leading-relaxed">
                Top hypotheses are far apart with comparable confidence. Treat all of them as tentative and look at the
                evidence trail before deciding.
              </p>
            </div>
          )}

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <div>
              <AgentTree events={events} />
            </div>
            <div className="space-y-4">
              {mapCandidates.length > 0 && <MapView candidates={mapCandidates} />}
              {result ? (
                <ResultView result={result} />
              ) : (
                running && (
                  <div className="space-y-4">
                    {preliminary.length > 0 && (
                      <section className="card p-5">
                        <h2 className="flex items-center gap-2 text-sm font-medium text-slate-300">
                          <MapPin size={15} className="text-cyan-400" /> Preliminary hypotheses
                        </h2>
                        <ul className="mt-3 space-y-2">
                          {preliminary.map((c) => (
                            <li
                              key={c.id}
                              className="animate-fade-up flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-2 text-sm"
                            >
                              <span className="min-w-0 truncate text-slate-200">{c.label}</span>
                              <span className="shrink-0 font-mono text-xs text-slate-500">
                                {Math.round(c.confidence * 100)}% · {c.sources[0]}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    <EvidenceList evidence={liveEvidence} />
                  </div>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
