import { NextResponse } from "next/server";
import type { AppRole, UserContext } from "./types";
import { createServiceSupabase } from "./supabase";

const roleRank: Record<AppRole, number> = {
  viewer: 1,
  supervisor: 2,
  admin: 3
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function requireUser(request: Request): Promise<UserContext> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) {
    throw new ApiError(401, "请先登录。");
  }

  const supabase = createServiceSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.id || !userData.user.email) {
    throw new ApiError(401, "登录已失效，请重新登录。");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    throw new ApiError(403, "账号未启用或没有权限。");
  }

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role
  };
}

export function requireRole(user: UserContext, roles: AppRole[]) {
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "当前角色没有权限执行此操作。");
  }
}

export function canWrite(user: UserContext) {
  return roleRank[user.role] >= roleRank.supervisor;
}

export function requireMinimumRole(user: UserContext, role: AppRole) {
  if (roleRank[user.role] < roleRank[role]) {
    throw new ApiError(403, "当前角色没有权限执行此操作。");
  }
}
