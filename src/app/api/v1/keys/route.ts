import { NextRequest, NextResponse } from "next/server";
import { createKey, listKeys } from "@/lib/api/keys";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok", keys: await listKeys() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { label?: unknown };
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : "dev key";
  const record = await createKey(label);
  return NextResponse.json(
    {
      status: "created",
      key: record.key,
      label: record.label,
      quota: record.quota,
      API_Requests_remaining: record.quota - record.used,
    },
    { status: 201 },
  );
}
