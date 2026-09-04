import { CodeBlocks } from "@/components/code-blocks";
import { KeyManager } from "@/components/key-manager";

const ENDPOINTS: { method: string; path: string; body: string }[] = [
  { method: "POST", path: "/api/v1/analyze", body: "multipart/form-data — submit an analysis, returns a job id" },
  { method: "GET", path: "/api/v1/jobs/{id}", body: "job snapshot: status, files, and the final result when finished" },
  { method: "GET", path: "/api/v1/jobs/{id}/events", body: "Server-Sent Events stream of the live agent run" },
  { method: "GET", path: "/api/v1/health", body: "service health and AI provider status" },
  { method: "POST", path: "/api/v1/keys", body: "create a dev API key (quota 100)" },
  { method: "GET", path: "/api/v1/keys", body: "list API keys (redacted)" },
];

const PARAMS: { name: string; type: string; body: string }[] = [
  { name: "files", type: "file[]", body: "1–5 images (fields files or file). JPEG, PNG, WebP, HEIC; 10 MB total. Ignored in event mode." },
  { name: "mode", type: "string", body: "fast (single vision pass, default) · agent (full swarm) · event (text-only description)" },
  { name: "description", type: "string", body: "event description, required for event mode (min 20 chars); optional extra context otherwise" },
];

const SSE_EVENTS: { event: string; body: string }[] = [
  { event: "processing", body: "job-level progress messages" },
  { event: "branch_point", body: "a fork in the agent tree with its queued branches" },
  { event: "branch_update", body: "per-agent status: processing, completed, failed, or skipped, with duration and token usage" },
  { event: "evidence", body: "one piece of weighted evidence added to the trail" },
  { event: "candidate", body: "a location hypothesis — preliminary (pre-fusion) or fused (final)" },
  { event: "completed", body: "final result: fused locations, evidence, agent stats, notes" },
  { event: "error", body: "terminal failure with a message" },
];

const ERRORS: { code: string; body: string }[] = [
  { code: "400", body: "invalid_form · invalid_mode · no_files · too_many_files · too_large · unsupported_media · short_description" },
  { code: "401", body: "invalid_api_key" },
  { code: "404", body: "not_found (unknown job id — jobs live in server memory)" },
  { code: "415", body: "unsupported_media (video is not supported yet — export key frames)" },
  { code: "429", body: "quota_exceeded (API key quota exhausted)" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-50">API reference</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
        Locus is API-first: everything the UI does is available over REST plus a live SSE stream. Without an{" "}
        <code className="rounded bg-slate-900/60 px-1">X-API-Key</code> header, requests are unlimited in this self-hosted
        deployment; keyed requests carry a quota reported as{" "}
        <code className="rounded bg-slate-900/60 px-1">API_Requests_remaining</code>.
      </p>

      <Section title="Endpoints">
        <div className="card divide-y divide-slate-800/70">
          {ENDPOINTS.map((e) => (
            <div key={e.path + e.method} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4 text-sm">
              <span className="w-14 shrink-0 font-mono text-xs font-semibold text-cyan-300">{e.method}</span>
              <span className="font-mono text-xs text-slate-200">{e.path}</span>
              <span className="basis-full text-xs leading-relaxed text-slate-500 sm:basis-auto">{e.body}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="POST /api/v1/analyze — parameters">
        <div className="card divide-y divide-slate-800/70">
          {PARAMS.map((p) => (
            <div key={p.name} className="p-4 text-sm">
              <span className="font-mono text-xs text-slate-200">{p.name}</span>
              <span className="ml-2 rounded border border-slate-700/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                {p.type}
              </span>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Authentication & keys">
        <KeyManager />
      </Section>

      <Section title="Examples">
        <CodeBlocks />
      </Section>

      <Section title="SSE event types">
        <p className="mb-4 text-sm leading-relaxed text-slate-400">
          Every event carries a monotonically increasing <code className="rounded bg-slate-900/60 px-1">id</code>; reconnects
          replay anything after <code className="rounded bg-slate-900/60 px-1">Last-Event-Id</code>. The stream emits{" "}
          <code className="rounded bg-slate-900/60 px-1">: keepalive</code> comments and closes after{" "}
          <code className="rounded bg-slate-900/60 px-1">completed</code> or{" "}
          <code className="rounded bg-slate-900/60 px-1">error</code>.
        </p>
        <div className="card divide-y divide-slate-800/70">
          {SSE_EVENTS.map((e) => (
            <div key={e.event} className="p-4 text-sm">
              <span className="font-mono text-xs text-cyan-300">{e.event}</span>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{e.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Errors">
        <div className="card divide-y divide-slate-800/70">
          {ERRORS.map((e) => (
            <div key={e.code} className="flex items-baseline gap-4 p-4 text-sm">
              <span className="w-8 shrink-0 font-mono text-xs font-semibold text-rose-300">{e.code}</span>
              <span className="font-mono text-xs leading-relaxed text-slate-400">{e.body}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Configuration">
        <div className="card p-5 text-sm leading-relaxed text-slate-400">
          <p>
            The reasoning agents talk to any OpenAI-compatible{" "}
            <code className="rounded bg-slate-900/60 px-1">/chat/completions</code> endpoint via environment variables:
          </p>
          <ul className="mt-3 space-y-1.5 font-mono text-xs text-slate-300">
            <li>AI_BASE_URL — default https://openrouter.ai/api/v1</li>
            <li>AI_API_KEY — required for vision/knowledge agents</li>
            <li>AI_MODEL — default openai/gpt-4o (any vision-capable model)</li>
          </ul>
          <p className="mt-3">
            Without a key, the platform still runs: EXIF forensics and fusion execute deterministically, and LLM branches
            are reported as <span className="text-amber-300">skipped</span> rather than failing silently.
          </p>
        </div>
      </Section>
    </div>
  );
}
