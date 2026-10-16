import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrganization } from "@/modules/users";
import { exchangePairingCode } from "@/modules/integrations";

const exchangeSchema = z.object({
  pairingCode: z.string().trim().min(1).max(255),
  hcsCompanyId: z.string().trim().min(1).max(255),
  hcsCompanyName: z.string().trim().min(1).max(255),
  requestedBy: z.object({
    userId: z.string().trim().min(1).max(255),
    email: z.string().email(),
  }),
});

function errorResponse(status: number) {
  return NextResponse.json({ error: "Request could not be processed" }, { status });
}

export async function POST(request: Request) {
  const credential = request.headers.get("x-hcs-server-token")?.trim();
  if (!credential) return errorResponse(401);

  let parsed: z.infer<typeof exchangeSchema>;
  try {
    parsed = exchangeSchema.parse(await request.json());
  } catch {
    return errorResponse(400);
  }

  try {
    const result = await exchangePairingCode({
      pairingCode: parsed.pairingCode,
      hcsCompanyId: parsed.hcsCompanyId,
      hcsCompanyName: parsed.hcsCompanyName,
      requestedBy: parsed.requestedBy,
      serverCredential: credential,
    });
    const organization = await getOrganization(result.connection.organizationId);
    if (!organization) return errorResponse(404);

    return NextResponse.json({
      connectionId: result.connection.id,
      marketingHubOrganizationId: organization.id,
      organizationName: organization.name,
      accessToken: result.accessToken,
      expiresAt: result.connection.expiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("credential")) return errorResponse(401);
    if (message.includes("pairing")) return errorResponse(404);
    return errorResponse(400);
  }
}
