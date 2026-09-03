import {
  Cpu,
  Eye,
  Fingerprint,
  Layers,
  Network,
  Radar,
  ShieldCheck,
  Target,
  Terminal,
} from "lucide-react";
import { AnalyzeForm } from "@/components/analyze-form";
import { HistoryPanel } from "@/components/history-panel";
import { llmEnabled } from "@/lib/engine/llm";

const FEATURES = [
  {
    icon: Network,
    title: "Parallel agent swarm",
    body: "EXIF forensics, scene vision, signage analysis, and knowledge search run as independent branches you watch live.",
  },
  {
    icon: Fingerprint,
    title: "EXIF forensics",
    body: "Device GPS, capture time, and camera fingerprints are extracted and fused with visual hypotheses — no LLM required.",
  },
  {
    icon: Eye,
    title: "Evidence-first results",
    body: "Every prediction ships its full evidence trail with per-clue weights, so conclusions are auditable, not black boxes.",
  },
  {
    icon: Target,
    title: "Calibrated confidence",
    body: "Candidates carry honest confidence scores, uncertainty radii, and explicit disagreement flags between agents.",
  },
  {
    icon: Terminal,
    title: "Streaming API",
    body: "REST + Server-Sent Events with branch events, evidence streams, and replay via Last-Event-Id. Keys and quotas built in.",
  },
  {
    icon: Cpu,
    title: "Pluggable intelligence",
    body: "Bring any OpenAI-compatible vision endpoint — OpenRouter, OpenAI, vLLM, or Ollama. Self-hosted, your data stays yours.",
  },
];

const STEPS = [
  { n: "01", title: "Upload or describe", body: "Drop an image set (up to 5) or describe an event in plain text." },
  { n: "02", title: "Watch the swarm", body: "Agents stream their reasoning live: EXIF, scene clues, signage, knowledge search." },
  { n: "03", title: "Get fused results", body: "Ranked locations on a map with calibrated confidence, radii, and the full evidence trail." },
];

export default function HomePage() {
  const aiReady = llmEnabled();

  return (
    <div>
      <section className="relative overflow-hidden border-b border-slate-800/60">
        <div className="bg-grid absolute inset-0 opacity-70" />
        <div className="absolute -top-40 left-1/2 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          {!aiReady && (
            <div className="card relative mb-8 border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-200/90">
              <strong className="font-semibold">Vision agents are disabled.</strong> No AI provider is configured. EXIF
              forensics and fusion still work — set <code className="rounded bg-slate-900/60 px-1">AI_API_KEY</code> in{" "}
              <code className="rounded bg-slate-900/60 px-1">.env.local</code> (any OpenAI-compatible endpoint) to unlock
              scene, signage, and knowledge agents.
            </div>
          )}
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-slate-50 sm:text-5xl">
            Pinpoint where any photo was taken.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Locus runs a transparent swarm of reasoning agents — EXIF forensics, scene vision, signage analysis, and world
            knowledge — then fuses their evidence into calibrated location hypotheses with a complete audit trail.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <Radar size={15} className="text-cyan-400" /> 6 reasoning agents
            </span>
            <span className="flex items-center gap-2">
              <Layers size={15} className="text-cyan-400" /> 3 analysis modes
            </span>
            <span className="flex items-center gap-2">
              <Terminal size={15} className="text-cyan-400" /> SSE streaming API
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-cyan-400" /> self-hosted &amp; pluggable
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <AnalyzeForm />
          <HistoryPanel />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="text-lg font-semibold text-slate-100">Built for evidence, not vibes</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card p-5">
                <Icon size={18} className="text-cyan-400" />
                <h3 className="mt-3 text-sm font-semibold text-slate-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="text-lg font-semibold text-slate-100">How it works</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-5">
              <span className="font-mono text-xs text-cyan-400">{s.n}</span>
              <h3 className="mt-2 text-sm font-semibold text-slate-100">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-800/60 py-8">
        <div className="mx-auto max-w-6xl px-4 text-xs leading-relaxed text-slate-500">
          Locus · agentic geolocation intelligence · built for authorized OSINT, journalism, and research use. Respect
          privacy and local law when analysing images.
        </div>
      </footer>
    </div>
  );
}
