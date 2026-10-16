import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateHcsRequest, errorResponse } from "@/modules/integrations";
import { validateRaffleCode } from "@/modules/raffles";

const bodySchema = z.object({
  code: z.string().trim().min(1).max(255),
  actor: z.object({ userId: z.string().trim().min(1), email: z.string().email(), name: z.string().trim().min(1) }),
  requestId: z.string().trim().min(1).max(255),
});

function statusFor(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") return error.status;
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
  if (!actorId || !actorEmail) return errorResponse(400);

  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return errorResponse(400);
  }
  if (body.actor.userId !== actorId || body.actor.email !== actorEmail) return errorResponse(403);

  try {
    const result = await validateRaffleCode({
      eventId: (await params).eventId,
      organizationId: auth.connection.organizationId,
      connectionId: auth.connection.id,
      requestId: body.requestId,
      code: body.code,
      actor: { type: "hcs", actorId, email: actorEmail, name: body.actor.name, source: "hcs" },
    });
    if (!result.hasPrize) return NextResponse.json({ valid: true, hasPrize: false, message: "Participante válido, todavía no tiene premio asignado" });
    return NextResponse.json({
      valid: true,
      event: { id: result.event.id, name: result.event.name },
      winner: {
        id: result.winner.id,
        name: result.winner.name,
        prizeName: result.winner.prizeName,
        drawId: result.winner.drawId,
        drawnAt: result.winner.drawnAt.toISOString(),
        claimStatus: result.winner.claimStatus,
        emailStatus: result.winner.emailStatus,
      },
    });
  } catch (error) {
    return errorResponse(statusFor(error));
  }
}
