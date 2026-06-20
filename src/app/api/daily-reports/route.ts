import { NextResponse } from "next/server";
import { jsonError, requireMinimumRole, requireUser } from "@/lib/auth";
import { createReportBundle, listReportSummaries } from "@/lib/db";
import { reportBundleSchema } from "@/lib/schemas";
import type { ReportBundle } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const reports = await listReportSummaries();
    return NextResponse.json({ reports });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    requireMinimumRole(user, "supervisor");
    const bundle = reportBundleSchema.parse(await request.json()) as ReportBundle;
    const saved = await createReportBundle(user, bundle);
    return NextResponse.json({ bundle: saved }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
