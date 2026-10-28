import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), rate: vi.fn(), audit: vi.fn(), revalidate: vi.fn(),
  delete: vi.fn(), restore: vi.fn(), get: vi.fn(), archive: vi.fn(), name: vi.fn(), description: vi.fn(), image: vi.fn(), utm: vi.fn(),
}));
vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/modules/audit", () => ({ checkRateLimit: mocks.rate, recordAudit: mocks.audit }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("@/modules/qr", () => ({
  deleteQrCode: mocks.delete, restoreQrCode: mocks.restore, getQrCode: mocks.get,
  archiveQrCode: mocks.archive, updateQrCodeName: mocks.name, updateQrDescription: mocks.description, updateQrPlacementImage: mocks.image,
}));
vi.mock("@/modules/links", () => ({ updateLinkUtmValues: mocks.utm, getLink: vi.fn().mockResolvedValue({ organizationId: "org-1", destinationUrl: "https://example.com" }) }));
vi.mock("@/modules/campaigns", () => ({}));
vi.mock("@/modules/utm", () => ({}));
import * as actions from "./actions";

const id = "11111111-1111-4111-8111-111111111111";
const form = () => {
  const data = new FormData();
  data.set("id", id); data.set("qrId", id); data.set("name", "Name");
  return data;
};
const user = (role = "MARKETING_MANAGER", status = "active") => ({ id: "user-1", profile: { organizationId: "org-1", role, status } });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue(user());
  mocks.rate.mockReturnValue(true);
  mocks.delete.mockResolvedValue({ id, deletedAt: new Date() });
  mocks.restore.mockResolvedValue({ id, deletedAt: null });
  mocks.get.mockResolvedValue({ id, organizationId: "org-1", deletedAt: new Date(), mode: "dynamic", linkId: id });
});

describe.each(["deleteQrCodeAction", "restoreQrCodeAction"] as const)("%s", (name) => {
  const invoke = (data = form()) => actions[name]({}, data);
  it.each(["ADMIN", "MARKETING_MANAGER"])("allows active %s and scopes the mutation", async (role) => {
    mocks.user.mockResolvedValue(user(role));
    expect(typeof actions[name]).toBe("function");
    await expect(invoke()).resolves.toEqual({ success: true });
    expect(name === "deleteQrCodeAction" ? mocks.delete : mocks.restore).toHaveBeenCalledWith(id, "org-1");
    expect(mocks.revalidate).toHaveBeenCalledWith("/qr");
  });
  it.each(["RECEPTION", "MARKETING_USER", "VIEWER", "EVENT_EDITOR"])("rejects %s without side effects", async (role) => {
    mocks.user.mockResolvedValue(user(role));
    await expect(invoke()).resolves.toHaveProperty("error");
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled(); expect(mocks.restore).not.toHaveBeenCalled();
  });
  it("rejects disabled managers", async () => {
    mocks.user.mockResolvedValue(user("MARKETING_MANAGER", "disabled"));
    await expect(invoke()).resolves.toHaveProperty("error");
    expect(mocks.delete).not.toHaveBeenCalled(); expect(mocks.restore).not.toHaveBeenCalled();
  });
  it("returns a sign-in error for unauthenticated requests", async () => {
    mocks.user.mockResolvedValue(undefined);
    await expect(invoke()).resolves.toHaveProperty("error");
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled(); expect(mocks.restore).not.toHaveBeenCalled();
  });
  it("returns actionable rate-limit and validation errors", async () => {
    mocks.rate.mockReturnValue(false);
    expect((await invoke()).error).toMatch(/Int.ntalo/);
    mocks.rate.mockReturnValue(true);
    await expect(invoke(new FormData())).resolves.toHaveProperty("error");
    expect(mocks.delete).not.toHaveBeenCalled(); expect(mocks.restore).not.toHaveBeenCalled();
  });
  it("returns an error for missing, foreign, or already-transitioned rows", async () => {
    mocks.delete.mockResolvedValue(undefined); mocks.restore.mockResolvedValue(undefined);
    await expect(invoke()).resolves.toHaveProperty("error");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

it("never audits or revalidates an unsuccessful scoped archive", async () => {
  await actions.archiveQrCodeAction(form());
  expect(mocks.archive).toHaveBeenCalledWith(id, "org-1");
  expect(mocks.audit).not.toHaveBeenCalled();
  expect(mocks.revalidate).not.toHaveBeenCalled();
});

it.each(["updateQrNameAction", "updateQrMetadataAction", "updateDynamicQrUtmAction"] as const)("rejects normal edits of deleted QR: %s", async (name) => {
  await expect(actions[name]({}, form())).resolves.toHaveProperty("error");
  for (const mutation of [mocks.name, mocks.description, mocks.image, mocks.utm]) expect(mutation).not.toHaveBeenCalled();
});

it.each(["updateQrNameAction", "updateQrMetadataAction", "updateDynamicQrUtmAction"] as const)("rejects edits of a foreign QR: %s", async (name) => {
  mocks.get.mockResolvedValue({ id, organizationId: "org-other", deletedAt: null, mode: "dynamic", linkId: id });
  await expect(actions[name]({}, form())).resolves.toHaveProperty("error");
  for (const mutation of [mocks.name, mocks.description, mocks.image, mocks.utm]) expect(mutation).not.toHaveBeenCalled();
});
