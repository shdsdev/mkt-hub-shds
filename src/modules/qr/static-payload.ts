export type StaticPayloadInput =
  | { kind: "text"; content: string }
  | { kind: "vcard"; fullName: string; phone: string; email: string; company?: string; website?: string }
  | { kind: "email"; address: string; subject?: string; body?: string }
  | { kind: "sms"; number: string; message?: string }
  | { kind: "wifi"; ssid: string; password: string; security: "WPA" | "WEP" | "nopass"; hidden: boolean };

// vCard 3.0 escaping (RFC 2426 §5.8.4): backslash, comma, semicolon.
function escapeVCard(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

// WIFI: URI escaping: backslash, semicolon, comma, double quote.
function escapeWifi(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/"/g, '\\"');
}

// Builds the exact string stored as qr_codes.static_payload for every non-"Sitio web" content
// type — done server-side (not in the client form) so escaping/validation lives in one place.
export function buildStaticPayload(input: StaticPayloadInput): string {
  switch (input.kind) {
    case "text":
      return input.content;
    case "vcard": {
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${escapeVCard(input.fullName)}`,
        `TEL:${escapeVCard(input.phone)}`,
        `EMAIL:${escapeVCard(input.email)}`,
      ];
      if (input.company) lines.push(`ORG:${escapeVCard(input.company)}`);
      if (input.website) lines.push(`URL:${escapeVCard(input.website)}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
    case "email": {
      const params = new URLSearchParams();
      if (input.subject) params.set("subject", input.subject);
      if (input.body) params.set("body", input.body);
      const query = params.toString();
      return `mailto:${input.address}${query ? `?${query}` : ""}`;
    }
    case "sms": {
      const params = new URLSearchParams();
      if (input.message) params.set("body", input.message);
      const query = params.toString();
      return `sms:${input.number}${query ? `?${query}` : ""}`;
    }
    case "wifi":
      return `WIFI:T:${input.security};S:${escapeWifi(input.ssid)};P:${escapeWifi(input.password)};H:${input.hidden};;`;
  }
}
