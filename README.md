# Locus — Agentic Geolocation Intelligence

Self-hosted, evidence-first image geolocation platform: a transparent swarm of reasoning agents (EXIF forensics, scene vision, signage & text, knowledge search) whose outputs are fused into calibrated location hypotheses with a complete audit trail. Think GeoSeer-style product, but pluggable, self-hostable, and API-native.

## Features

- **Three analysis modes** — `fast` (single vision pass), `agent` (full parallel swarm + refinement), `event` (text-only incident description).
- **EXIF forensics** — device GPS, capture time, camera fingerprint; works with zero LLM configuration.
- **Deterministic fusion** — geographic clustering with per-source reliability weighting (noisy-OR), uncertainty radii, and agent-disagreement flags.
- **Live agent tree** — every branch streams status, duration, and token usage over SSE.
- **REST + SSE API** — `POST /api/v1/analyze`, job snapshots, replayable event streams (`Last-Event-Id`), API keys with quotas. Full reference at `/docs` on the running app.
- **Pluggable intelligence** — any OpenAI-compatible vision endpoint (OpenRouter, OpenAI, vLLM, Ollama) via `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL`.

## Quickstart

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Optional: `cp .env.example .env.local` and set `AI_API_KEY` (plus `AI_BASE_URL`/`AI_MODEL` if not using OpenRouter). Without a key the platform still runs — EXIF forensics and fusion work, and LLM branches are reported as skipped.

## Architecture

```
src/lib/engine/          orchestrator, agents (exif/scene/text/search/vision), fusion, store, LLM client
src/app/api/v1/          REST + SSE endpoints (analyze, jobs, keys, health)
src/app/                 UI: landing + upload, live job view (agent tree, map, evidence), API docs
tests/                   vitest: fusion math + EXIF extraction (uses fixtures/)
scripts/make_fixtures.py generates JPEG fixtures with/without EXIF GPS
```

## Tests

```bash
pnpm test        # vitest: fusion clustering + EXIF GPS extraction
pnpm typecheck   # tsc --noEmit
```

## Roadmap

Video frame extraction, reverse-image and satellite/street-view matching agents, C2PA/provenance checks, PostgreSQL persistence, multi-tenant keys and quotas.

## Responsible use

Built for authorized OSINT, journalism, and research. Respect privacy and applicable law when analysing images.
