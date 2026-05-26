import { NextRequest, NextResponse } from "next/server";
import { requireCronOrAdmin } from "@/lib/auth";
import { sweepReactivations } from "@/lib/agents/proactive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // proactive sweep runs many LLM calls

async function run(req: NextRequest) {
  if (!(await requireCronOrAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sweepReactivations();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
