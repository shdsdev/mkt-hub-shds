import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { env } from "@/lib/env";
import { hcsConnections, hcsPairingCodes, integrationIdempotencyRecords } from "./db";

const TOKEN_BYTES = 32;

export function hashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function verifySecret(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isHcsPairingCredential(value: string): boolean {
  const expected = Buffer.from(env.MARKETING_HUB_SERVER_TOKEN, "utf8");
  const actual = Buffer.from(value, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function createAccessToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function createPairingCodeValue(): string {
  return randomBytes(16).toString("hex").toUpperCase();
}

export async function createPairingCode(input: {
  organizationId: string;
  expiresAt: Date;
}) {
  const code = createPairingCodeValue();
  const [row] = await db
    .insert(hcsPairingCodes)
    .values({ organizationId: input.organizationId, codeHash: hashSecret(code), expiresAt: input.expiresAt })
    .returning();
  return { row, code };
}

export async function exchangePairingCode(input: {
  pairingCode: string;
  hcsCompanyId: string;
  hcsCompanyName: string;
  requestedBy: {
    userId: string;
    email: string;
  };
  serverCredential: string;
  expiresAt?: Date;
  now?: Date;
}) {
  if (!isHcsPairingCredential(input.serverCredential)) throw new Error("Invalid HCS pairing credential");
  const now = input.now ?? new Date();
  const accessToken = createAccessToken();

  return db.transaction(async (tx) => {
    const [pairing] = await tx
      .select()
      .from(hcsPairingCodes)
      .where(
        and(
          eq(hcsPairingCodes.codeHash, hashSecret(input.pairingCode)),
          isNull(hcsPairingCodes.usedAt),
          gt(hcsPairingCodes.expiresAt, now),
        ),
      )
      .limit(1);
    if (!pairing || pairing.usedAt || pairing.expiresAt <= now) throw new Error("Invalid or expired pairing code");

    const [usedPairing] = await tx
      .update(hcsPairingCodes)
      .set({ usedAt: now })
      .where(and(eq(hcsPairingCodes.id, pairing.id), isNull(hcsPairingCodes.usedAt)))
      .returning();
    if (!usedPairing) throw new Error("Pairing code already used");

    const [connection] = await tx
      .insert(hcsConnections)
      .values({
        organizationId: pairing.organizationId,
        hcsCompanyId: input.hcsCompanyId,
        hcsCompanyName: input.hcsCompanyName,
        hcsRequestedByUserId: input.requestedBy.userId,
        hcsRequestedByEmail: input.requestedBy.email,
        accessTokenHash: hashSecret(accessToken),
        accessTokenPrefix: accessToken.slice(0, 8),
        expiresAt: input.expiresAt ?? null,
      })
      .returning();
    return { connection, accessToken };
  });
}

export async function authenticateHcsToken(token: string, hcsCompanyId?: string, now = new Date()) {
  const rows = await db
    .select()
    .from(hcsConnections)
    .where(
      and(
        eq(hcsConnections.accessTokenHash, hashSecret(token)),
        isNull(hcsConnections.revokedAt),
        or(isNull(hcsConnections.expiresAt), gt(hcsConnections.expiresAt, now)),
        ...(hcsCompanyId ? [eq(hcsConnections.hcsCompanyId, hcsCompanyId)] : []),
      ),
    )
    .limit(1);
  const connection = rows[0];
  if (!connection) throw new Error(hcsCompanyId ? "Token/company mismatch" : "Invalid HCS token");
  return connection;
}

export type SafeHcsConnection = Pick<
  typeof hcsConnections.$inferSelect,
  | "id"
  | "organizationId"
  | "hcsCompanyId"
  | "hcsCompanyName"
  | "accessTokenPrefix"
  | "revokedAt"
  | "expiresAt"
  | "createdAt"
  | "updatedAt"
>;

export async function listHcsConnections(organizationId: string): Promise<SafeHcsConnection[]> {
  const rows = await db
    .select()
    .from(hcsConnections)
    .where(eq(hcsConnections.organizationId, organizationId))
    .limit(100);

  return rows.map(({ accessTokenHash, ...safeConnection }) => {
    void accessTokenHash;
    return safeConnection;
  });
}

export async function revokeHcsConnection(input: {
  organizationId: string;
  connectionId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [connection] = await db
    .update(hcsConnections)
    .set({ revokedAt: now, updatedAt: now })
    .where(and(eq(hcsConnections.id, input.connectionId), eq(hcsConnections.organizationId, input.organizationId)))
    .returning();
  return connection;
}

export async function renewHcsConnection(input: {
  organizationId: string;
  connectionId: string;
  expiresAt: Date | null;
  now?: Date;
}) {
  const accessToken = createAccessToken();
  const now = input.now ?? new Date();
  const [connection] = await db
    .update(hcsConnections)
    .set({
      accessTokenHash: hashSecret(accessToken),
      accessTokenPrefix: accessToken.slice(0, 8),
      revokedAt: null,
      expiresAt: input.expiresAt,
      updatedAt: now,
    })
    .where(and(eq(hcsConnections.id, input.connectionId), eq(hcsConnections.organizationId, input.organizationId)))
    .returning();
  if (!connection) throw new Error("HCS connection is not renewable");
  return { connection, accessToken };
}

function hashRequest(payload: unknown): string {
  return hashSecret(JSON.stringify(payload));
}

export async function getIdempotencyReplay(
  connectionId: string,
  operation: string,
  key: string,
  request: unknown,
): Promise<{ status: number; body: Record<string, unknown> } | undefined> {
  const [record] = await db
    .select()
    .from(integrationIdempotencyRecords)
    .where(
      and(
        eq(integrationIdempotencyRecords.connectionId, connectionId),
        eq(integrationIdempotencyRecords.operation, operation),
        eq(integrationIdempotencyRecords.key, key),
      ),
    )
    .limit(1);
  if (!record) return undefined;
  if (!verifySecret(JSON.stringify(request), record.requestHash)) {
    throw new Error("Idempotency key payload mismatch");
  }
  return { status: record.responseStatus, body: record.responseBody };
}

export async function saveIdempotencyResponse(
  connectionId: string,
  operation: string,
  key: string,
  request: unknown,
  status: number,
  body: Record<string, unknown>,
) {
  const [record] = await db
    .insert(integrationIdempotencyRecords)
    .values({
      connectionId,
      operation,
      key,
      requestHash: hashRequest(request),
      responseStatus: status,
      responseBody: body,
    })
    .returning();
  return record;
}

type IdempotencyClient = Pick<typeof db, "insert" | "select" | "update" | "execute">;

export async function runIdempotentResponse<T extends Record<string, unknown>>(input: {
  connectionId: string;
  operation: string;
  key: string;
  request: unknown;
  transactional?: boolean;
  execute: (client: IdempotencyClient) => Promise<{ status: number; body: T }>;
}): Promise<{ status: number; body: T; replayed: boolean }> {
  if (input.transactional === false) {
    const reservation = await db.transaction(async (tx): Promise<
      | { status: number; body: T; replayed: boolean }
      | { id: string; pending: boolean }
    > => {
      const requestHash = hashRequest(input.request);
      const [inserted] = await tx
        .insert(integrationIdempotencyRecords)
        .values({
          connectionId: input.connectionId,
          operation: input.operation,
          key: input.key,
          requestHash,
          responseStatus: 102,
          responseBody: { pending: true },
        })
        .onConflictDoNothing({
          target: [integrationIdempotencyRecords.connectionId, integrationIdempotencyRecords.operation, integrationIdempotencyRecords.key],
        })
        .returning();

      const [record] = await tx
        .select()
        .from(integrationIdempotencyRecords)
        .where(
          and(
            eq(integrationIdempotencyRecords.connectionId, input.connectionId),
            eq(integrationIdempotencyRecords.operation, input.operation),
            eq(integrationIdempotencyRecords.key, input.key),
          ),
        )
        .limit(1)
        .for("update");
      if (!record) throw new Error("Idempotency reservation unavailable");
      if (record.requestHash !== requestHash) throw new Error("Idempotency key payload mismatch");
      if (record.responseStatus !== 102) {
        return { status: record.responseStatus, body: record.responseBody as T, replayed: true };
      }
      return { id: record.id, pending: !inserted };
    });

    if ("status" in reservation) return reservation;
    if (reservation.pending) {
      return { status: 409, body: { error: "Request is already in progress" } as unknown as T, replayed: false };
    }

    const result = await input.execute(db);
    await db.transaction(async (tx) => {
      await tx
        .update(integrationIdempotencyRecords)
        .set({ responseStatus: result.status, responseBody: result.body })
        .where(eq(integrationIdempotencyRecords.id, reservation.id));
    });
    return { ...result, replayed: false };
  }

  return db.transaction(async (tx) => {
    const requestHash = hashRequest(input.request);
    await tx
      .insert(integrationIdempotencyRecords)
      .values({
        connectionId: input.connectionId,
        operation: input.operation,
        key: input.key,
        requestHash,
        responseStatus: 102,
        responseBody: { pending: true },
      })
      .onConflictDoNothing({
        target: [integrationIdempotencyRecords.connectionId, integrationIdempotencyRecords.operation, integrationIdempotencyRecords.key],
      })
      .returning();

    const [record] = await tx
      .select()
      .from(integrationIdempotencyRecords)
      .where(
        and(
          eq(integrationIdempotencyRecords.connectionId, input.connectionId),
          eq(integrationIdempotencyRecords.operation, input.operation),
          eq(integrationIdempotencyRecords.key, input.key),
        ),
      )
      .limit(1)
      .for("update");
    if (!record) throw new Error("Idempotency reservation unavailable");
    if (record.requestHash !== requestHash) throw new Error("Idempotency key payload mismatch");
    if (record.responseStatus !== 102) {
      return { status: record.responseStatus, body: record.responseBody as T, replayed: true };
    }

    const result = await input.execute(tx);
    await tx
      .update(integrationIdempotencyRecords)
      .set({ responseStatus: result.status, responseBody: result.body })
      .where(eq(integrationIdempotencyRecords.id, record.id));
    return { ...result, replayed: false };
  });
}
