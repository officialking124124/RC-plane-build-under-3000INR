"use client";

import { useEffect, useState } from "react";

const ANALYZE_CURL = `curl -X POST {ORIGIN}/api/v1/analyze \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -F "files=@/path/to/image.jpg" \\
  -F "mode=agent"`;

const RESPONSE_JSON = `{
  "status": "accepted",
  "job_id": "job_a1b2c3d4e5f6",
  "mode": "agent",
  "events_url": "/api/v1/jobs/job_a1b2c3d4e5f6/events",
  "status_url": "/api/v1/jobs/job_a1b2c3d4e5f6",
  "API_Requests_remaining": 99
}`;

const RESULT_JSON = `{
  "status": "ok",
  "job_id": "job_a1b2c3d4e5f6",
  "mode": "agent",
  "job_status": "completed",
  "result": {
    "status": "success",
    "locations": [
      {
        "id": "c1",
        "label": "48.8584° N 2.2945° E (EXIF GPS)",
        "latitude": 48.8584,
        "longitude": 2.2945,
        "confidence": 0.98,
        "radiusKm": 0.25,
        "reasoning": "[exif] EXIF metadata embeds device-recorded GPS coordinates…",
        "sources": ["exif", "scene"],
        "fused": true,
        "evidenceIds": ["e1", "e2"]
      }
    ],
    "evidence": [ { "id": "e1", "agent": "exif", "kind": "exif-gps", "weight": "strong", "…": "…" } ],
    "disagreement": false,
    "processing_time": "1.2s",
    "agent_stats": [ { "agent": "exif", "status": "completed", "durationMs": 14 } ],
    "notes": [],
    "API_Requests_remaining": "unlimited"
  }
}`;

const SSE_STREAM = `: keepalive

id: 3
event: branch_point
data: {"seq":3,"type":"branch_point","forkId":"fork-parallel","forkLabel":"Parallel analysis","branches":[{"id":"exif","label":"EXIF Forensics","status":"queued"},…]}

id: 7
event: evidence
data: {"seq":7,"type":"evidence","evidence":{"id":"e1","agent":"exif","kind":"exif-gps","title":"EXIF GPS coordinates","weight":"strong",…}}

id: 12
event: completed
data: {"seq":12,"type":"completed","result":{"status":"success","locations":[…],"processingTimeMs":1180,…}}`;

export function CodeBlocks() {
  const [origin, setOrigin] = useState("https://your-locus-host");
  useEffect(() => setOrigin(window.location.origin), []);

  const blocks: { title: string; code: string }[] = [
    { title: "Submit an analysis", code: ANALYZE_CURL.replace("{ORIGIN}", origin) },
    { title: "202 Accepted", code: RESPONSE_JSON },
    { title: "GET /api/v1/jobs/{id} — final result", code: RESULT_JSON },
    { title: "GET /api/v1/jobs/{id}/events — SSE stream (excerpt)", code: SSE_STREAM },
  ];

  return (
    <div className="space-y-4">
      {blocks.map((b) => (
        <div key={b.title}>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-slate-500">{b.title}</p>
          <pre className="card overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-300">{b.code}</pre>
        </div>
      ))}
    </div>
  );
}
