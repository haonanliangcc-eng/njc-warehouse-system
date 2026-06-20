import { NextResponse } from "next/server";
import { jsonError, requireRole, requireMinimumRole, requireUser } from "@/lib/auth";
import { deleteReport, loadReportBundle, updateReportBundle } from "@/lib/db";
import { reportBundleSchema } from "@/lib/schemas";
import type { ReportBundle } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser(request);
    const { id } = await context.params;
    const bundle = await loadReportBundle(id);
    return NextResponse.json({ bundle });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    requireMinimumRole(user, "supervisor");
    const { id } = await context.params;
    const bundle = reportBundleSchema.parse(await request.json()) as ReportBundle;
    const saved = await updateReportBundle(user, id, bundle);
    return NextResponse.json({ bundle: saved });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    requireRole(user, ["admin"]);
    const { id } = await context.params;
    await deleteReport(user, id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
