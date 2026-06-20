import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { extname } from "path";
import { jsonError, requireMinimumRole, requireUser } from "@/lib/auth";
import { createServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const allowedTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    requireMinimumRole(user, "supervisor");

    const formData = await request.formData();
    const reportId = String(formData.get("report_id") ?? "");
    const incidentId = String(formData.get("incident_id") ?? "");
    const file = formData.get("file");

    if (!reportId || !incidentId) {
      return NextResponse.json({ error: "report_id and incident_id are required" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "图片最大 10 MB。" }, { status: 400 });
    }
    const safeExt = allowedTypes.get(file.type);
    if (!safeExt) {
      return NextResponse.json({ error: "只允许 jpg、jpeg、png、webp 图片。" }, { status: 400 });
    }

    const originalExt = extname(file.name).toLowerCase();
    const extension = originalExt === ".jpeg" ? ".jpg" : safeExt;
    const storagePath = `reports/${reportId}/incidents/${incidentId}/${randomUUID()}${extension}`;
    const bytes = await file.arrayBuffer();
    const supabase = createServiceSupabase();

    const { error: uploadError } = await supabase.storage
      .from("warehouse-files")
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false
      });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("incident_photos")
      .insert({
        incident_id: incidentId,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        created_by: user.id
      })
      .select("*")
      .single();
    if (error) throw error;

    const { data: signed } = await supabase.storage
      .from("warehouse-files")
      .createSignedUrl(storagePath, 60 * 10);

    return NextResponse.json({ photo: { ...data, signed_url: signed?.signedUrl } });
  } catch (error) {
    return jsonError(error);
  }
}
