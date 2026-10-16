import { z } from "zod";
import type { NextRequest } from "next/server";
import { authenticateHcsRequest, errorResponse } from "@/modules/integrations";

type LifecycleValidation =
  | { response: Response }
  | { connection: Awaited<ReturnType<typeof authenticateHcsRequest>>["connection"] };

export async function validateLifecycleRequest(
  request: NextRequest,
  connectionId: string,
): Promise<LifecycleValidation> {
  if (!z.string().uuid().safeParse(connectionId).success) return { response: errorResponse(400) } as const;

  const actorId = request.headers.get("x-hcs-actor-id")?.trim();
  const actorEmail = request.headers.get("x-hcs-actor-email")?.trim();
  if (!actorId || !actorEmail) return { response: errorResponse(400) } as const;

  try {
    if ((await request.text()).trim()) return { response: errorResponse(400) } as const;
  } catch {
    return { response: errorResponse(400) } as const;
  }

  try {
    const { connection } = await authenticateHcsRequest(request);
    if (connection.id !== connectionId) return { response: errorResponse(403) } as const;
    return { connection } as const;
  } catch (error) {
    return { response: errorResponse(error) } as const;
  }
}
