import { NextResponse } from "next/server";
import { jsonError, requireRole, requireMinimumRole, requireUser } from "@/lib/auth";
import { deleteReport, loadReportBundle, updateReportBundle } from "@/lib/db";
import { reportBundleSchema, reportSectionUpdateSchema } from "@/lib/schemas";
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    requireMinimumRole(user, "supervisor");
    const { id } = await context.params;
    const { section, bundle } = reportSectionUpdateSchema.parse(await request.json());
    const incoming = bundle as ReportBundle;
    const latest = await loadReportBundle(id);

    const merged: ReportBundle = {
      ...latest,
      report: {
        ...latest.report,
        version: latest.report.version
      }
    };

    if (section === "report") {
      merged.report = {
        ...latest.report,
        report_date: incoming.report.report_date,
        shift: incoming.report.shift,
        status: incoming.report.status,
        general_notes: incoming.report.general_notes,
        version: latest.report.version
      };
    }

    if (section === "shipments") merged.shipments = incoming.shipments;
    if (section === "customs") merged.customs = incoming.customs;
    if (section === "labor") merged.labor = incoming.labor;
    if (section === "tasks") merged.tasks = incoming.tasks;
    if (section === "incidents") merged.incidents = incoming.incidents;
    if (section === "signatures") merged.signatures = incoming.signatures;
    if (section === "handovers") merged.handovers = incoming.handovers;
    if (section === "morning_returns") {
      merged.handovers = [
        ...latest.handovers.filter((item) => item.priority !== "morning_return"),
        ...incoming.handovers.filter((item) => item.priority === "morning_return")
      ];
    }
    if (section === "task_handover") {
      merged.handovers = [
        ...latest.handovers.filter((item) => item.priority !== "task_handover"),
        ...incoming.handovers.filter((item) => item.priority === "task_handover")
      ];
    }
    if (section === "evening_logistics") {
      const eveningPriorities = new Set(["evening_dispatch", "morning_material", "evening_pickup"]);
      merged.handovers = [
        ...latest.handovers.filter((item) => !eveningPriorities.has(item.priority)),
        ...incoming.handovers.filter((item) => eveningPriorities.has(item.priority))
      ];
    }

    const saved = await updateReportBundle(user, id, merged);
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
