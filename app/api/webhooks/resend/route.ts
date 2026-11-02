import { env } from "@/lib/env";
import { processResendWebhookEvent } from "@/modules/email-marketing";
import { verifyResendWebhookSignature } from "./signature";

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  if (!env.RESEND_WEBHOOK_SECRET) return Response.json({ error: "Webhook secret is not configured" }, { status: 500 });
  if (!verifyResendWebhookSignature(body, request.headers, env.RESEND_WEBHOOK_SECRET)) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  try {
    const event = JSON.parse(body) as { type?: string; created_at?: string; data?: Record<string, unknown> };
    const providerEventId = request.headers.get("svix-id");
    if (!event.type || !providerEventId) return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
    const result = await processResendWebhookEvent(providerEventId, {
      type: event.type,
      created_at: event.created_at,
      data: event.data,
    });
    return Response.json({ ok: true, result });
  } catch {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
}
