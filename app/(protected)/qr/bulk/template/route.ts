import { getCurrentUser } from "@/modules/auth";

export const BULK_QR_TEMPLATE_FILENAME = "plantilla_codigos_qr.csv";

export const BULK_QR_TEMPLATE_CSV =
  "URL,Titulo del codigo QR (referencia)\r\n" +
  "http://www.tu-sitio.com,Mi codigo QR 1\r\n" +
  "http://www.tu-sitio.com,Mi codigo QR 2\r\n" +
  "http://www.tu-sitio.com,Mi codigo QR 3\r\n";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  return new Response(BULK_QR_TEMPLATE_CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${BULK_QR_TEMPLATE_FILENAME}"`,
    },
  });
}
