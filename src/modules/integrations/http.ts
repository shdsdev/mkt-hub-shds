import { NextResponse, type NextRequest } from "next/server";
import { getOrganization } from "@/modules/users";
import { authenticateHcsToken } from "./service";

export class HcsHttpError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 404 | 409 | 429) {
    super("HCS request rejected");
  }
}

export function errorResponse(error: unknown) {
  const status = typeof error === "number" ? error : error instanceof HcsHttpError ? error.status : 400;
  return NextResponse.json({ error: "Request could not be processed" }, { status });
}

export async function authenticateHcsRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const companyId = request.headers.get("x-hcs-company-id")?.trim();
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match || !companyId) throw new HcsHttpError(401);

  let connection;
  try {
    connection = await authenticateHcsToken(match[1], companyId);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("company")) throw new HcsHttpError(403);
    throw new HcsHttpError(401);
  }

  if (!(await getOrganization(connection.organizationId))) throw new HcsHttpError(403);
  return { connection };
}
