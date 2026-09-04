"use client";

import { useEffect, useState } from "react";

interface Health {
  ai: { configured: boolean; model: string; provider: string };
}

export function ProviderStatus() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch("/api/v1/health")
      .then((r) => (r.ok ? r.json() : null))
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  if (!health) return null;
  return (
    <span
      title={health.ai.configured ? `${health.ai.model} via ${health.ai.provider}` : "Set AI_API_KEY to enable vision agents"}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        health.ai.configured
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${health.ai.configured ? "bg-emerald-400" : "bg-amber-400"}`} />
      AI: {health.ai.configured ? health.ai.model : "not configured"}
    </span>
  );
}
