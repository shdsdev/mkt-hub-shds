import { getCurrentUser } from "@/modules/auth";
import { listQrCodes } from "@/modules/qr";
import { listShortLinksForOrganization } from "@/modules/links";
import { DynamicQrForm } from "./dynamic-qr-form";
import { StaticQrForm } from "./static-qr-form";
import { archiveQrCodeAction } from "./actions";

export default async function QrPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [qrCodes, shortLinks] = await Promise.all([
    listQrCodes(user.profile.organizationId),
    listShortLinksForOrganization(user.profile.organizationId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">QR Codes</h1>
        <p className="text-sm text-muted-foreground">
          Dynamic QR codes point at a short link and stay editable after printing. Static QR
          codes encode a fixed payload and can never be changed.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 font-heading font-medium">Dynamic QR</h2>
          <DynamicQrForm shortLinks={shortLinks} organizationId={user.profile.organizationId} />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 font-heading font-medium">Static QR</h2>
          <StaticQrForm organizationId={user.profile.organizationId} />
        </div>
      </div>

      <div className="space-y-2">
        {qrCodes.length === 0 && (
          <p className="text-sm text-muted-foreground">No QR codes yet.</p>
        )}
        {qrCodes.map((qr) => (
          <div
            key={qr.id}
            className="flex items-center justify-between rounded-md border border-border bg-card p-4"
          >
            <div>
              <p className="font-medium">{qr.mode === "dynamic" ? "Dynamic" : "Static"}</p>
              <p className="text-xs text-muted-foreground">
                {qr.mode === "static" ? qr.staticPayload : qr.status} · EC {qr.errorCorrectionLevel}
                {qr.logoUrl ? " · logo" : ""}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <a href={`/qr/${qr.id}/download?format=png`} className="text-accent hover:underline">
                PNG
              </a>
              {!qr.logoUrl && (
                <a href={`/qr/${qr.id}/download?format=svg`} className="text-accent hover:underline">
                  SVG
                </a>
              )}
              {qr.status === "active" && (
                <form action={archiveQrCodeAction}>
                  <input type="hidden" name="id" value={qr.id} />
                  <button type="submit" className="text-accent hover:underline">
                    Archive
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
