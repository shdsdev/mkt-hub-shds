import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    insert: mocks.insert,
    select: mocks.select,
    update: mocks.update,
    transaction: mocks.transaction,
  },
}));

import { env } from "@/lib/env";
import {
  authenticateHcsToken,
  createPairingCode,
  exchangePairingCode,
  hashSecret,
  verifySecret,
  isHcsPairingCredential,
  renewHcsConnection,
  revokeHcsConnection,
  listHcsConnections,
  saveIdempotencyResponse,
  getIdempotencyReplay,
  runIdempotentResponse,
} from "./service";

describe("HCS integration service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.MARKETING_HUB_SERVER_TOKEN = "server-credential";
  });

  it("hashes secrets irreversibly and verifies without exposing raw values", () => {
    const hash = hashSecret("opaque-secret");
    expect(hash).not.toContain("opaque-secret");
    expect(hashSecret("opaque-secret")).toBe(hash);
    expect(hashSecret("different-secret")).not.toBe(hash);
    expect(verifySecret("opaque-secret", hash)).toBe(true);
    expect(verifySecret("different-secret", hash)).toBe(false);
  });

  it("checks the exchange credential through the env getter", () => {
    expect(isHcsPairingCredential("server-credential")).toBe(true);
    expect(isHcsPairingCredential("wrong")).toBe(false);
    delete process.env.MARKETING_HUB_SERVER_TOKEN;
    expect(() => isHcsPairingCredential("server-credential")).toThrow(/MARKETING_HUB_SERVER_TOKEN/);
  });

  it("creates a pairing code while inserting only its hash", async () => {
    const row = { id: "pairing-1", organizationId: "org-1" };
    mocks.returning.mockResolvedValue([row]);
    mocks.values.mockReturnValue({ returning: mocks.returning });
    mocks.insert.mockReturnValue({ values: mocks.values });

    const result = await createPairingCode({
      organizationId: "org-1",
      expiresAt: new Date("2026-10-17T00:00:00Z"),
    });

    expect(result.row).toEqual(row);
    expect(result.code).toMatch(/^[A-Z0-9]{32}$/);
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", codeHash: hashSecret(result.code) }),
    );
    expect(JSON.stringify(mocks.values.mock.calls[0][0])).not.toContain(result.code);
  });

  it("exchanges a valid pairing code once and binds the connection to its organization", async () => {
    const pairing = {
      id: "pairing-1",
      organizationId: "org-1",
      codeHash: hashSecret("PAIRING-CODE"),
      expiresAt: new Date("2026-10-18T00:00:00Z"),
      usedAt: null,
    };
    const connection = {
      id: "connection-1",
      organizationId: "org-1",
      hcsCompanyId: "company-1",
      hcsCompanyName: "Acme",
    };
    const insertValues = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([connection]) });
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([pairing]) }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([pairing]) }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: insertValues,
      }),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));

    const result = await exchangePairingCode({
      pairingCode: "PAIRING-CODE",
      hcsCompanyId: "company-1",
      hcsCompanyName: "Acme",
      requestedBy: { userId: "user-1", email: "operator@example.com" },
      serverCredential: env.MARKETING_HUB_SERVER_TOKEN,
      now: new Date("2026-10-17T00:00:00Z"),
    });

    expect(result.connection).toEqual(connection);
    expect(result.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tx.update).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        hcsCompanyId: "company-1",
        hcsRequestedByUserId: "user-1",
        hcsRequestedByEmail: "operator@example.com",
      }),
    );
  });

  it("rejects expired pairing codes and wrong exchange credentials", async () => {
    await expect(
      exchangePairingCode({
        pairingCode: "PAIRING-CODE",
        hcsCompanyId: "company-1",
        hcsCompanyName: "Acme",
        requestedBy: { userId: "user-1", email: "operator@example.com" },
        serverCredential: "wrong",
      }),
    ).rejects.toThrow(/credential/i);
  });

  it("rejects an expired pairing row even if the repository returns it", async () => {
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "pairing-1",
                organizationId: "org-1",
                expiresAt: new Date("2026-10-16T00:00:00Z"),
                usedAt: null,
              },
            ]),
          }),
        }),
      }),
      update: vi.fn(),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      exchangePairingCode({
        pairingCode: "PAIRING-CODE",
        hcsCompanyId: "company-1",
        hcsCompanyName: "Acme",
        requestedBy: { userId: "user-1", email: "operator@example.com" },
        serverCredential: "server-credential",
        now: new Date("2026-10-17T00:00:00Z"),
      }),
    ).rejects.toThrow(/expired/i);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("authenticates a token and enforces optional company scoping", async () => {
    const token = "access-token";
    mocks.limit
      .mockResolvedValueOnce([
      {
        id: "connection-1",
        organizationId: "org-1",
        hcsCompanyId: "company-1",
        revokedAt: null,
        expiresAt: null,
      },
      ])
      .mockResolvedValueOnce([]);
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.select.mockReturnValue({ from: mocks.from });

    await expect(authenticateHcsToken(token, "company-1")).resolves.toMatchObject({ id: "connection-1" });
    await expect(authenticateHcsToken(token, "company-2")).rejects.toThrow(/company/i);
  });

  it("revokes and renews a connection without returning a stored token", async () => {
    mocks.where.mockReturnValue({ returning: mocks.returning });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.update.mockReturnValue({ set: mocks.set });
    mocks.returning.mockResolvedValue([{ id: "connection-1", revokedAt: new Date() }]);
    await expect(revokeHcsConnection({ organizationId: "org-1", connectionId: "connection-1" })).resolves.toBeDefined();
    const renewed = await renewHcsConnection({ organizationId: "org-1", connectionId: "connection-1", expiresAt: null });
    expect(renewed).toMatchObject({
      accessToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    expect(mocks.set.mock.calls[1][0].accessTokenHash).not.toBe(renewed.accessToken);
  });

  it("lists only safe connection metadata for one organization", async () => {
    const connection = {
      id: "connection-1",
      organizationId: "org-1",
      hcsCompanyId: "company-1",
      hcsCompanyName: "Acme",
      accessTokenHash: "secret-hash",
      accessTokenPrefix: "abc12345",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt: new Date("2026-04-01T00:00:00Z"),
      revokedAt: null,
    };
    mocks.limit.mockResolvedValue([connection]);
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.select.mockReturnValue({ from: mocks.from });

    const result = await listHcsConnections("org-1");

    expect(result).toEqual([
      expect.objectContaining({
        id: "connection-1",
        organizationId: "org-1",
        hcsCompanyId: "company-1",
        accessTokenPrefix: "abc12345",
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("secret-hash");
  });

  it("requires organization scope when revoking and renewing", async () => {
    mocks.where.mockReturnValue({ returning: mocks.returning });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.update.mockReturnValue({ set: mocks.set });
    mocks.returning.mockResolvedValue([{ id: "connection-1", organizationId: "org-1", revokedAt: null }]);

    await revokeHcsConnection({ organizationId: "org-1", connectionId: "connection-1" });
    await renewHcsConnection({ organizationId: "org-1", connectionId: "connection-1", expiresAt: new Date("2027-01-01T00:00:00Z") });

    expect(mocks.where.mock.calls[0][0]).toBeDefined();
    expect(mocks.where.mock.calls[1][0]).toBeDefined();
  });

  it("replays an identical idempotent response and rejects a payload mismatch", async () => {
    mocks.limit.mockResolvedValue([
      {
        requestHash: hashSecret('{"name":"Acme"}'),
        responseStatus: 201,
        responseBody: { id: "connection-1" },
      },
    ]);
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.select.mockReturnValue({ from: mocks.from });

    await expect(
      getIdempotencyReplay("connection-1", "hcs.exchange", "request-1", { name: "Acme" }),
    ).resolves.toEqual({ status: 201, body: { id: "connection-1" } });
    await expect(
      getIdempotencyReplay("connection-1", "hcs.exchange", "request-1", { name: "Other" }),
    ).rejects.toThrow(/payload/i);

    mocks.returning.mockResolvedValue([{ id: "idem-1" }]);
    mocks.values.mockReturnValue({ returning: mocks.returning });
    mocks.insert.mockReturnValue({ values: mocks.values });
    await saveIdempotencyResponse("connection-1", "hcs.exchange", "request-1", { name: "Acme" }, 201, {
      id: "connection-1",
    });
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ responseStatus: 201 }));
  });

  it("reserves an idempotency key before running the mutation and stores its response in the same transaction", async () => {
    const record: { id: string; requestHash: string; responseStatus: number; responseBody: Record<string, unknown> } = { id: "idem-1", requestHash: hashSecret('{"drawId":"draw-1"}'), responseStatus: 102, responseBody: { pending: true } };
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([record]) }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ for: vi.fn().mockResolvedValue([record]) }) }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    const execute = vi.fn().mockResolvedValue({ status: 200, body: { success: true } });

    await expect(runIdempotentResponse({ connectionId: "connection-1", operation: "raffle.claim", key: "claim-1", request: { drawId: "draw-1" }, execute })).resolves.toEqual({ status: 200, body: { success: true }, replayed: false });

    expect(execute).toHaveBeenCalledWith(tx);
    expect(tx.update).toHaveBeenCalled();
  });

  it("runs non-transactional work after the reservation commits and finalizes it separately", async () => {
    const record: { id: string; requestHash: string; responseStatus: number; responseBody: Record<string, unknown> } = { id: "idem-1", requestHash: hashSecret('{"drawId":"draw-1"}'), responseStatus: 102, responseBody: { pending: true } };
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([record]) }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ for: vi.fn().mockResolvedValue([record]) }) }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    };
    let transactionActive = false;
    mocks.transaction.mockImplementation(async (callback) => {
      transactionActive = true;
      try {
        return await callback(tx);
      } finally {
        transactionActive = false;
      }
    });
    const execute = vi.fn().mockImplementation(async () => {
      expect(transactionActive).toBe(false);
      return { status: 200, body: { success: true } };
    });

    await expect(runIdempotentResponse({
      connectionId: "connection-1",
      operation: "raffle.resend",
      key: "resend-1",
      request: { drawId: "draw-1" },
      transactional: false,
      execute,
    })).resolves.toEqual({ status: 200, body: { success: true }, replayed: false });

    expect(execute).toHaveBeenCalledWith(expect.not.objectContaining(tx));
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(tx.update).toHaveBeenCalled();
  });

  it("returns a retryable conflict for a committed pending reservation without executing work", async () => {
    const record = { id: "idem-1", requestHash: hashSecret('{"drawId":"draw-1"}'), responseStatus: 102, responseBody: { pending: true } };
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ for: vi.fn().mockResolvedValue([record]) }) }),
        }),
      }),
      update: vi.fn(),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    const execute = vi.fn();

    await expect(runIdempotentResponse({
      connectionId: "connection-1",
      operation: "raffle.resend",
      key: "resend-1",
      request: { drawId: "draw-1" },
      transactional: false,
      execute,
    })).resolves.toEqual({ status: 409, body: { error: "Request is already in progress" }, replayed: false });

    expect(execute).not.toHaveBeenCalled();
  });

  it("persists a provider failure and replays it exactly without executing the same key again", async () => {
    const record: { id: string; requestHash: string; responseStatus: number; responseBody: Record<string, unknown> } = { id: "idem-1", requestHash: hashSecret('{"drawId":"draw-1"}'), responseStatus: 102, responseBody: { pending: true } };
    let insertCount = 0;
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(async () => (insertCount++ === 0 ? [record] : [])),
          }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ for: vi.fn().mockResolvedValue([record]) }) }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((values: { responseStatus: number; responseBody: Record<string, unknown> }) => {
          record.responseStatus = values.responseStatus;
          record.responseBody = values.responseBody;
          return { where: vi.fn().mockResolvedValue(undefined) };
        }),
      }),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    const failure = { status: 400, body: { error: "Request could not be processed" } };
    const execute = vi.fn().mockResolvedValue(failure);
    const input = {
      connectionId: "connection-1",
      operation: "raffle.resend",
      key: "resend-1",
      request: { drawId: "draw-1" },
      transactional: false,
      execute,
    };

    await expect(runIdempotentResponse(input)).resolves.toEqual({ ...failure, replayed: false });
    await expect(runIdempotentResponse(input)).resolves.toEqual({ ...failure, replayed: true });

    expect(execute).toHaveBeenCalledOnce();
    expect(record.responseStatus).toBe(400);
    expect(record.responseBody).toEqual(failure.body);
  });
});
