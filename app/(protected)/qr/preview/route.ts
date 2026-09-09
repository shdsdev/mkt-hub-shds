import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { exportQrPng } from "@/modules/qr";
import { getShortLink, getDomain } from "@/modules/links";

const previewSchema = z.object({
  shortLinkId: z.string().uuid().optional(),
  payload: z.string().min(1).max(2048).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  foregroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]),
  logoUrl: z.string().url().optional(),
});

// Live preview while creating a QR code — no row exists yet, so this resolves the same
// encoded-value logic the download route uses, without persisting anything.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse(null, { status: 401 });
  }

  const parsed = previewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  let encodedValue: string;
  if (parsed.data.shortLinkId) {
    const shortLink = await getShortLink(parsed.data.shortLinkId);
    const domain = shortLink ? await getDomain(shortLink.domainId) : undefined;
    if (!shortLink || shortLink.organizationId !== user.profile.organizationId || !domain) {
      return new NextResponse(null, { status: 404 });
    }
    encodedValue = `https://${domain.hostname}/q/${shortLink.slug}`;
  } else if (parsed.data.payload) {
    encodedValue = parsed.data.payload;
  } else {
    return new NextResponse(null, { status: 400 });
  }

  const png = await exportQrPng(encodedValue, {
    backgroundColor: parsed.data.backgroundColor,
    foregroundColor: parsed.data.foregroundColor,
    errorCorrectionLevel: parsed.data.errorCorrectionLevel,
    logoUrl: parsed.data.logoUrl,
  });

  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
