import { NextResponse } from "next/server";
import { ApiError, jsonError } from "@/lib/auth";
import { createViewerProfile } from "@/lib/db";
import { registerSchema } from "@/lib/schemas";
import { createServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    const supabase = createServiceSupabase();
    const { data, error } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name
      }
    });

    if (error || !data.user?.id || !data.user.email) {
      throw new ApiError(400, error?.message || "注册失败，请检查邮箱和密码。");
    }

    await createViewerProfile({
      id: data.user.id,
      email: data.user.email,
      full_name: body.full_name
    });

    return NextResponse.json(
      {
        ok: true,
        message: "账号已注册，请登录。"
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
