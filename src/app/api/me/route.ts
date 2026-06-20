import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return NextResponse.json({ user });
  } catch (error) {
    return jsonError(error);
  }
}
