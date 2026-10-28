import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), qr: vi.fn(), track: vi.fn(), visitor: vi.fn() }));
vi.mock("@/modules/links", () => ({ resolveShortLinkByHostAndSlug: mocks.resolve, buildDestinationUrl: () => "https://example.com/destination" }));
vi.mock("@/modules/qr", () => ({ getQrCodeByShortLinkId: mocks.qr }));
vi.mock("@/modules/analytics", () => ({
  ANALYTICS_CONSENT_COOKIE: "consent", getConsentIdFromToken: vi.fn(), hasAnalyticsConsent: vi.fn(),
  trackRedirect: mocks.track, resolveVisitor: mocks.visitor, normalizeReferrer: () => undefined,
}));
vi.mock("@/lib/env", () => ({ env: {} }));
import { handleRedirect } from "./http";

const request = () => new NextRequest("https://go.example.com/q/code", { headers: { host: "go.example.com" } });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolve.mockResolvedValue({ link: { id: "link-1", organizationId: "org-1" }, shortLink: { id: "short-1" } });
  mocks.qr.mockResolvedValue({ deletedAt: new Date() });
});

it("returns readable Spanish 410 without analytics or visitor cookies for a trashed /q", async () => {
  const response = await handleRedirect(request(), "code", "qr_scan");
  expect(response.status).toBe(410);
  expect(await response.text()).toMatch(/QR.*papelera/);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(mocks.qr).toHaveBeenCalledWith("short-1", "org-1");
  expect(mocks.track).not.toHaveBeenCalled();
  expect(mocks.visitor).not.toHaveBeenCalled();
});

it("does not consult QR trash for /r sharing the same short link", async () => {
  const response = await handleRedirect(request(), "code", "link_click");
  expect(response.status).toBe(302);
  expect(mocks.qr).not.toHaveBeenCalled();
  expect(mocks.track).toHaveBeenCalledOnce();
});

it.each([undefined, { deletedAt: null, status: "archived" }, { deletedAt: null, status: "disabled" }])("preserves existing resolution when the QR is not trashed: %j", async (qr) => {
  mocks.qr.mockResolvedValue(qr);
  expect((await handleRedirect(request(), "code", "qr_scan")).status).toBe(302);
  expect(mocks.track).toHaveBeenCalledOnce();
});

it("preserves 404 for a missing short link without looking up a QR", async () => {
  mocks.resolve.mockResolvedValue(undefined);
  expect((await handleRedirect(request(), "missing", "qr_scan")).status).toBe(404);
  expect(mocks.qr).not.toHaveBeenCalled();
  expect(mocks.track).not.toHaveBeenCalled();
});
