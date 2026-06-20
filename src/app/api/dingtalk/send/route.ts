import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { z } from "zod";
import { jsonError, requireMinimumRole, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

const pushSchema = z.object({
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  warehouse: z.string().min(1).max(120),
  total_shipments: z.number().int().min(0),
  total_pallets: z.number().int().min(0),
  labor_count: z.number().int().min(0),
  incident_count: z.number().int().min(0),
  unfinished_count: z.number().int().min(0)
});

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string) {
  const now = Date.now();
  const current = rateLimit.get(userId);
  if (!current || current.resetAt < now) {
    rateLimit.set(userId, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (current.count >= 5) {
    return NextResponse.json({ error: "推送过于频繁，请稍后再试。" }, { status: 429 });
  }
  current.count += 1;
}

function buildMessage(input: z.infer<typeof pushSchema>) {
  return [
    `NJC仓运营日报 ${input.report_date}`,
    `仓库：${input.warehouse}`,
    `今日总发货量：${input.total_shipments}`,
    `今日总板数：${input.total_pallets}`,
    `劳务人数：${input.labor_count}`,
    `异常事件：${input.incident_count}`,
    `未完成事项：${input.unfinished_count}`
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    requireMinimumRole(user, "supervisor");
    const blocked = checkRateLimit(user.id);
    if (blocked) return blocked;

    const webhook = process.env.DINGTALK_WEBHOOK_URL;
    if (!webhook) {
      return NextResponse.json({ error: "服务器未配置 DINGTALK_WEBHOOK_URL。" }, { status: 500 });
    }

    const input = pushSchema.parse(await request.json());
    const text = buildMessage(input);

    let targetUrl = webhook;
    const secret = process.env.DINGTALK_SECRET;
    if (secret) {
      const timestamp = Date.now().toString();
      const sign = createHmac("sha256", secret)
        .update(`${timestamp}\n${secret}`)
        .digest("base64");
      const url = new URL(webhook);
      url.searchParams.set("timestamp", timestamp);
      url.searchParams.set("sign", sign);
      targetUrl = url.toString();
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "text",
        text: { content: text }
      })
    });

    if (!response.ok) {
      return NextResponse.json({ error: "钉钉推送失败。", status: response.status }, { status: 502 });
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    return jsonError(error);
  }
}
