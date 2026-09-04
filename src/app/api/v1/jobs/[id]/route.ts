import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/engine/store";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json(
      {
        status: "error",
        error: "not_found",
        message: "Unknown job id.",
      },
      { status: 404 },
    );
  }
  return NextResponse.json({
    status: "ok",
    job_id: job.id,
    mode: job.mode,
    job_status: job.status,
    created_at: new Date(job.createdAt).toISOString(),
    files: job.files.map((f) => ({ name: f.name, mime: f.mime, size: f.size })),
    result: job.result
      ? {
          status: job.result.status,
          locations: job.result.locations,
          evidence: job.result.evidence,
          disagreement: job.result.disagreement,
          processing_time: `${(job.result.processingTimeMs / 1000).toFixed(1)}s`,
          agent_stats: job.result.agentStats,
          notes: job.result.notes,
          API_Requests_remaining: job.result.requestsRemaining ?? "unlimited",
        }
      : null,
  });
}
