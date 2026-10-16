import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkHcsRaffleResendRateLimit } from "@/modules/audit";
import { authenticateHcsRequest, errorResponse, runIdempotentResponse } from "@/modules/integrations";
import { resendHcsWinnerEmail } from "@/modules/raffles";

const bodySchema = z.object({
  drawId: z.string().uuid(),
  actor: z.object({ userId: z.string().trim().min(1), email: z.string().email(), name: z.string().trim().min(1) }),
  reason: z.string().trim().max(1000).nullable(),
  idempotencyKey: z.string().trim().min(1).max(255),
});

function statusFor(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") return error.status;
  if (error instanceof Error && error.message.includes("Idempotency")) return 409;
  return 400;
}

type ResendResponse =
  | { success: true; email: { status: "resent"; sentAt: string } }
  | { error: string };

export async function POST(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  let auth;
  try {
    auth = await authenticateHcsRequest(request);
  } catch (error) {
    return errorResponse(error);
  }

  const actorId = request.headers.get("x-hcs-actor-id")?.trim();
  const actorEmail = request.headers.get("x-hcs-actor-email")?.trim();
  const headerKey = request.headers.get("idempotency-key")?.trim();
  if (!actorId || !actorEmail || !headerKey) return errorResponse(400);

  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return errorResponse(400);
  }
  if (body.idempotencyKey !== headerKey) return errorResponse(409);
  if (body.actor.userId !== actorId || body.actor.email !== actorEmail) return errorResponse(403);

  const eventId = (await params).eventId;
  try {
    const result = await runIdempotentResponse<ResendResponse>({
      connectionId: auth.connection.id,
      operation: "raffle.resend",
      key: headerKey,
      request: body,
      transactional: false,
      execute: async () => {
        if (!checkHcsRaffleResendRateLimit(auth.connection.id, actorId)) return { status: 429, body: { error: "Request could not be processed" } };
        try {
          const email = await resendHcsWinnerEmail({
            drawId: body.drawId,
            eventId,
            organizationId: auth.connection.organizationId,
            connectionId: auth.connection.id,
            actor: { type: "hcs", actorId, email: actorEmail, name: body.actor.name, source: "hcs" },
            reason: body.reason,
          });
          return { status: 200, body: { success: true, email: { status: "resent" as const, sentAt: email.sentAt.toISOString() } } };
        } catch (error) {
          return { status: statusFor(error), body: { error: "Request could not be processed" } };
        }
      },
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return errorResponse(statusFor(error));
  }
}
