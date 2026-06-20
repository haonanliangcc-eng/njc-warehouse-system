import { NextResponse } from "next/server";
import { jsonError, requireRole, requireUser } from "@/lib/auth";
import { listProfiles, updateProfile } from "@/lib/db";
import { profileUpdateSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    requireRole(user, ["admin"]);
    const profiles = await listProfiles();
    return NextResponse.json({ profiles });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    requireRole(user, ["admin"]);
    const body = await request.json();
    const id = String(body.id ?? "");
    const next = profileUpdateSchema.parse(body);
    const profile = await updateProfile(user, id, next);
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error);
  }
}
