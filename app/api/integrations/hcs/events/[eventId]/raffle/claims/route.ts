import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateHcsRequest, errorResponse, runIdempotentResponse } from "@/modules/integrations";
import { claimHcsDraw } from "@/modules/raffles";

const bodySchema = z.object({
  drawId: z.string().uuid(),
  code: z.string().trim().min(1).max(255),
  actor: z.object({ userId: z.string().trim().min(1), email: z.string().email(), name: z.string().trim().min(1) }),
  note: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().min(1).max(255),
});

function statusFor(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") return error.status;
  if (error instanceof Error && (error.message.includes("claimed") || error.message.includes("cannot be claimed") || error.message.includes("deadline") || error.message.includes("Idempotency"))) return 409;
  return 400;
}

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
  const requestPayload = body;
  try {
    const result = await runIdempotentResponse({
      connectionId: auth.connection.id,
      operation: "raffle.claim",
      key: headerKey,
      request: requestPayload,
      execute: async (client) => {
        const claim = await claimHcsDraw({
          drawId: body.drawId,
          code: body.code,
          eventId,
          organizationId: auth.connection.organizationId,
          actor: { type: "hcs", actorId, email: actorEmail, name: body.actor.name, source: "hcs" },
          note: body.note,
          client,
        });
        return { status: 200, body: { success: true, claim: { drawId: claim.drawId, status: "claimed" as const, claimedAt: claim.claimedAt?.toISOString(), claimedBy: claim.claimedBy } } };
      },
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return errorResponse(statusFor(error));
  }
}
