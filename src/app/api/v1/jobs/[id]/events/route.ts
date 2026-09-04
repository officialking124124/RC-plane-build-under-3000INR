import { NextRequest } from "next/server";
import { startJob } from "@/lib/engine/orchestrator";
import { getJob, subscribe } from "@/lib/engine/store";
import type { JobEvent } from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  let job = getJob(id);
  if (!job) {
    return new Response(
      JSON.stringify({
        status: "error",
        error: "not_found",
        message: "Unknown job id.",
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }
  if (job.status === "pending") startJob(id);
  const current = getJob(id);
  if (!current) return new Response("not found", { status: 404 });
  const jobEvents = current.events;
  const jobStatus = current.status;

  const lastEventId = Number.parseInt(req.headers.get("last-event-id") ?? "0", 10) || 0;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let sentSeq = lastEventId;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (event: JobEvent) => {
        write(`id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        sentSeq = Math.max(sentSeq, event.seq);
      };

      const unsubscribe = subscribe(id, (event) => {
        if (event.seq <= sentSeq) return;
        send(event);
        if (event.type === "completed" || event.type === "error") finish();
      });
      const keepAlive = setInterval(() => write(": keepalive\n\n"), 15000);

      const finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed by the platform
        }
      };

      for (const event of jobEvents) {
        if (event.seq > sentSeq) send(event);
      }
      if (jobStatus === "completed" || jobStatus === "failed") finish();
      req.signal.addEventListener("abort", finish);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
