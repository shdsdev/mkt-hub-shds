import { createSign } from "node:crypto";

const MEASUREMENT_PROTOCOL_TIMEOUT_MS = 10_000;

export type Ga4OutboxEvent = {
  id: string;
  clientId: string;
  linkId: string;
  shortLinkId: string | null;
  sourceType: "qr_scan" | "link_click";
};

export type MeasurementProtocolConfig = {
  measurementId: string;
  apiSecret: string;
};

export type MeasurementProtocolRequest = {
  url: string;
  body: {
    client_id: string;
    events: Array<{
      name: "mh_qr_scan" | "mh_short_link_click";
      params: {
        mh_link_key: string;
        mh_local_event_id: string;
        engagement_time_msec: number;
      };
    }>;
  };
};

export class Ga4DeliveryError extends Error {
  constructor(public readonly kind: "failed" | "uncertain", message: string) {
    super(message);
    this.name = "Ga4DeliveryError";
  }
}

export function buildMeasurementProtocolRequest(
  event: Ga4OutboxEvent,
  measurementId: string,
  apiSecret: string,
): MeasurementProtocolRequest {
  const query = new URLSearchParams({ measurement_id: measurementId, api_secret: apiSecret });
  return {
    url: `https://www.google-analytics.com/mp/collect?${query}`,
    body: {
      client_id: event.clientId,
      events: [{
        name: event.sourceType === "qr_scan" ? "mh_qr_scan" : "mh_short_link_click",
        params: {
          mh_link_key: event.linkId,
          mh_local_event_id: event.id,
          engagement_time_msec: 1,
        },
      }],
    },
  };
}

export async function sendMeasurementProtocolEvent(
  event: Ga4OutboxEvent,
  config: MeasurementProtocolConfig,
  fetcher: typeof fetch = fetch,
  timeoutMs = MEASUREMENT_PROTOCOL_TIMEOUT_MS,
): Promise<{ kind: "received" }> {
  const request = buildMeasurementProtocolRequest(event, config.measurementId, config.apiSecret);
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let response: Response;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Ga4DeliveryError("uncertain", "Measurement Protocol request timed out."));
      }, timeoutMs);
    });
    response = await Promise.race([
      fetcher(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
  } catch (error) {
    if (error instanceof Ga4DeliveryError) throw error;
    throw new Ga4DeliveryError("uncertain", error instanceof Error ? error.message : "Network failure");
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (response.ok) return { kind: "received" };
  if (response.status >= 400 && response.status < 500) {
    throw new Ga4DeliveryError("failed", `Measurement Protocol rejected the request (${response.status}).`);
  }
  throw new Ga4DeliveryError("uncertain", `Measurement Protocol unavailable (${response.status}).`);
}

type ServiceAccountTokenResponse = { access_token?: string };

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function createServiceAccountAssertion(email: string, privateKey: string, now = Math.floor(Date.now() / 1000)): string {
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey.replace(/\\n/g, "\n"), "base64url");
  return `${unsigned}.${signature}`;
}

export async function getGoogleAccessToken(
  email: string,
  privateKey: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createServiceAccountAssertion(email, privateKey),
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth token request failed (${response.status}).`);
  const data = (await response.json()) as ServiceAccountTokenResponse;
  if (!data.access_token) throw new Error("Google OAuth token response did not contain an access token.");
  return data.access_token;
}

export type Ga4ReportRequest = {
  dateRanges: Array<{ startDate: string; endDate: string }>;
  dimensions: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  dimensionFilter?: unknown;
};

export async function runGa4Report(
  propertyId: string,
  serviceAccountEmail: string,
  privateKey: string,
  report: Ga4ReportRequest,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  const accessToken = await getGoogleAccessToken(serviceAccountEmail, privateKey, fetcher);
  const response = await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
  if (!response.ok) throw new Error(`Google Analytics Data API failed (${response.status}).`);
  return response.json();
}
