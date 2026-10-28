import { processUnsubscribeRequest } from "@/modules/email-marketing";

type RouteContext = { params: Promise<{ token: string }> };

function responsePage(title: string, message: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f2efe9;color:#15434a;font-family:Arial,sans-serif"><main style="max-width:560px;margin:64px auto;padding:40px 24px;background:#fffcf7;text-align:center"><h1 style="margin:0 0 16px;font-size:28px">${title}</h1><p style="margin:0;line-height:1.6">${message}</p></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { token } = await context.params;
  const result = await processUnsubscribeRequest(token);
  if (!result.valid) return responsePage("Enlace no válido", "Este enlace de baja no es válido o ya no está disponible.", 404);
  return responsePage("Suscripción cancelada", "Dejaste de recibir campañas de Email Marketing. Los correos transaccionales de eventos pueden continuar llegando.");
}

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  const { token } = await context.params;
  const result = await processUnsubscribeRequest(token);
  return new Response(null, { status: result.valid ? 200 : 400 });
}
