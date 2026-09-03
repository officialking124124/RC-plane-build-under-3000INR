"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Network, TriangleAlert, UploadCloud, X, Zap } from "lucide-react";
import { addHistoryEntry, thumbFor } from "@/lib/client/history";
import type { JobMode } from "@/lib/engine/types";

const MODES: { id: JobMode; name: string; icon: typeof Zap; blurb: string; needsFiles: boolean }[] = [
  { id: "fast", name: "Fast", icon: Zap, blurb: "Single-pass vision analysis. Cheapest, quickest.", needsFiles: true },
  { id: "agent", name: "Agent", icon: Network, blurb: "Full swarm: EXIF, scene, signage, knowledge search, fusion.", needsFiles: true },
  { id: "event", name: "Event", icon: FileText, blurb: "Locate from an incident description — no image needed.", needsFiles: false },
];

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_FILES = 5;
const MAX_TOTAL = 10 * 1024 * 1024;

interface Picked {
  file: File;
  url: string;
}

export function AnalyzeForm() {
  const router = useRouter();
  const [mode, setMode] = useState<JobMode>("agent");
  const [files, setFiles] = useState<Picked[]>([]);
  const [description, setDescription] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<Picked[]>([]);
  filesRef.current = files;

  useEffect(
    () => () => {
      for (const f of filesRef.current) URL.revokeObjectURL(f.url);
    },
    [],
  );

  function addFiles(incoming: FileList | File[]) {
    setError(null);
    const next: Picked[] = [];
    for (const file of Array.from(incoming)) {
      if (!ALLOWED.includes(file.type)) {
        setError(`Unsupported type: ${file.name} (${file.type || "unknown"}). Use JPEG, PNG, WebP or HEIC.`);
        continue;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setFiles((prev) => {
      const merged = [...prev, ...next].slice(0, MAX_FILES);
      if (prev.length + next.length > MAX_FILES) setError(`Up to ${MAX_FILES} images per analysis — extra files dropped.`);
      return merged;
    });
  }

  const totalBytes = files.reduce((s, f) => s + f.file.size, 0);

  async function submit() {
    setError(null);
    if (mode !== "event" && files.length === 0) {
      setError("Attach at least one image.");
      return;
    }
    if (mode !== "event" && totalBytes > MAX_TOTAL) {
      setError("Total upload size must stay under 10 MB.");
      return;
    }
    if (mode === "event" && description.trim().length < 20) {
      setError("Describe the event in at least 20 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("mode", mode);
      if (mode === "event") form.set("description", description.trim());
      for (const f of files) form.append("files", f.file);
      const res = await fetch("/api/v1/analyze", { method: "POST", body: form });
      const data = (await res.json()) as { job_id?: string; message?: string };
      if (!res.ok || !data.job_id) throw new Error(data.message ?? `Request failed (${res.status})`);
      const thumb = mode === "event" ? null : await thumbFor(files[0]?.file ?? null);
      addHistoryEntry({ id: data.job_id, mode, createdAt: Date.now(), thumb, topLabel: null });
      router.push(`/job/${data.job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  const activeMode = MODES.find((m) => m.id === mode)!;

  return (
    <div className="card p-5 sm:p-6">
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                active
                  ? "border-cyan-400/50 bg-cyan-400/10"
                  : "border-slate-700/50 bg-slate-900/30 hover:border-slate-500/50"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <Icon size={15} className={active ? "text-cyan-300" : "text-slate-400"} />
                {m.name} mode
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-400">{m.blurb}</span>
            </button>
          );
        })}
      </div>

      {activeMode.needsFiles ? (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
            }}
            className={`mt-4 cursor-pointer rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
              dragging ? "border-cyan-400/60 bg-cyan-400/5" : "border-slate-700/60 hover:border-slate-500/60"
            }`}
          >
            <UploadCloud className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-3 text-sm font-medium text-slate-300">Drop images here or click to browse</p>
            <p className="mt-1 text-xs text-slate-500">
              Up to {MAX_FILES} images · JPEG, PNG, WebP, HEIC · 10 MB total
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {files.map((f) => (
                <div key={f.url} className="group relative overflow-hidden rounded-lg border border-slate-700/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={f.file.name}
                    className="aspect-square w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${f.file.name}`}
                    onClick={() => setFiles((prev) => prev.filter((p) => p.url !== f.url))}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-slate-950/80 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                  <span className="absolute bottom-0 left-0 right-0 truncate bg-slate-950/80 px-1.5 py-1 text-[10px] text-slate-400">
                    {f.file.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Describe the event or scene: what happened, what is visible, any place names, dates, or links mentioned around it…"
          className="mt-4 w-full rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
        />
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Starting analysis…
          </>
        ) : (
          <>Run {activeMode.name.toLowerCase()} analysis</>
        )}
      </button>
    </div>
  );
}
