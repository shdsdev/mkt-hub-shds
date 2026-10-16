import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { hcsConnections, hcsPairingCodes, integrationIdempotencyRecords } from "./db";

describe("integrations schema", () => {
  it("stores organization-scoped, one-time pairing codes", () => {
    expect(hcsPairingCodes.organizationId.notNull).toBe(true);
    expect(hcsPairingCodes.codeHash.notNull).toBe(true);
    expect(hcsPairingCodes.expiresAt.notNull).toBe(true);
    expect(hcsPairingCodes.usedAt.notNull).toBe(false);
  });

  it("stores HCS connections with opaque token hashes and revocation fields", () => {
    expect(hcsConnections.organizationId.notNull).toBe(true);
    expect(hcsConnections.hcsCompanyId.notNull).toBe(true);
    expect(hcsConnections.accessTokenHash.notNull).toBe(true);
    expect(hcsConnections.accessTokenPrefix.notNull).toBe(true);
    expect(hcsConnections.revokedAt.notNull).toBe(false);
    expect(hcsConnections.expiresAt.notNull).toBe(false);
    expect(hcsConnections.hcsRequestedByUserId.notNull).toBe(false);
    expect(hcsConnections.hcsRequestedByEmail.notNull).toBe(false);
  });

  it("uniquely scopes idempotency by connection, operation, and key", () => {
    const { uniqueConstraints } = getTableConfig(integrationIdempotencyRecords);
    expect(
      uniqueConstraints.some(
        (constraint) =>
          constraint.columns.map((column) => column.name).sort().join(",") ===
          ["connection_id", "operation", "key"].sort().join(","),
      ),
    ).toBe(true);
    expect(integrationIdempotencyRecords.requestHash.notNull).toBe(true);
    expect(integrationIdempotencyRecords.responseBody.notNull).toBe(true);
    expect(integrationIdempotencyRecords.responseStatus.notNull).toBe(true);
  });
});
