"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, MapPin, Trash2 } from "lucide-react";
import { clearHistory, getHistory, type HistoryEntry } from "@/lib/client/history";

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const update = () => setEntries(getHistory());
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside className="card h-fit p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <History size={15} className="text-cyan-400" />
          Recent analyses
        </h2>
        {entries.length > 0 && (
          <button
            type="button"
            aria-label="Clear history"
            onClick={() => {
              clearHistory();
              setEntries([]);
            }}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:text-rose-400"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Your last analyses will appear here. History is stored locally in your browser.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((e) => (
            <li key={e.id}>
              <Link
                href={`/job/${e.id}`}
                className="flex items-center gap-3 rounded-lg border border-slate-800/70 bg-slate-900/30 p-2 transition-colors hover:border-slate-600/60"
              >
                {e.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.thumb} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-800/60 text-slate-500">
                    <MapPin size={15} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-200">
                    {e.topLabel ?? "Analysis pending…"}
                  </span>
                  <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                    {e.mode} · {timeAgo(e.createdAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
