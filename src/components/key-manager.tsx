"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus } from "lucide-react";

interface RedactedKey {
  id: string;
  label: string;
  quota: number;
  remaining: number;
  createdAt: number;
}

export function KeyManager() {
  const [keys, setKeys] = useState<RedactedKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/v1/keys");
      const data = (await res.json()) as { keys?: RedactedKey[] };
      setKeys(data.keys ?? []);
    } catch {
      // offline
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function create() {
    setBusy(true);
    setNewKey(null);
    try {
      const res = await fetch("/api/v1/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = (await res.json()) as { key?: string };
      if (data.key) setNewKey(data.key);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium text-slate-300">
        <KeyRound size={15} className="text-cyan-400" /> API keys
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Requests without a key (like the UI itself) are unlimited in this self-hosted deployment. Programmatic clients
        should send <code className="rounded bg-slate-900/60 px-1 text-xs">X-API-Key</code>. Dev keys carry a quota of 100
        requests.
      </p>
      <button
        type="button"
        onClick={create}
        disabled={busy}
        className="mt-4 flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-400/20 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Generate dev key
      </button>

      {newKey && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-xs text-emerald-300">Copy this key now — it is shown only once.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-slate-950/70 px-2 py-1.5 font-mono text-xs text-emerald-200">
              {newKey}
            </code>
            <button
              type="button"
              aria-label="Copy key"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(newKey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  // clipboard unavailable
                }
              }}
              className="rounded-md border border-slate-700/60 p-1.5 text-slate-300"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      )}

      {keys.length > 0 && (
        <ul className="mt-4 space-y-2 text-xs">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2">
              <span className="font-mono text-slate-400">{k.id}</span>
              <span className="text-slate-500">
                {k.remaining}/{k.quota} left
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
