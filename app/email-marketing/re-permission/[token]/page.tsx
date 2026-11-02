import Image from "next/image";
import { confirmRepermissionAction, declineRepermissionAction } from "./actions";
import { getEmailRepermissionRequest } from "@/modules/email-marketing";

export default async function RepermissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { token } = await params;
  const { result } = await searchParams;
  const request = result ? undefined : await getEmailRepermissionRequest(token);
  const firstName = request?.contact.fullName?.split(" ")[0] || "equipo";

  return (
    <main className="min-h-screen bg-[#f4f3ef] px-4 py-12 text-[#242424] sm:px-6">
      <section className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-[#dcdad3] bg-white shadow-xl">
        <header className="bg-[#242424] px-6 py-5">
          <Image
            src="/logos/shades-de-mexico-white-v2.png"
            alt="Shades de México"
            width={480}
            height={143}
            className="h-auto w-40"
            priority
          />
        </header>
        <div className="h-1 bg-[#66cdcc]" />
        <div className="space-y-5 px-6 py-10 sm:px-10">
          {result === "confirmed" ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5c5c5c]">Preferencias actualizadas</p>
              <h1 className="text-3xl font-semibold tracking-tight">Gracias, ya estás suscrito.</h1>
               <p className="leading-7 text-[#5c5c5c]">Vamos a enviarte novedades y recursos de Shades de México. Puedes darte de baja desde cualquier correo.</p>
            </>
          ) : result === "declined" ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5c5c5c]">Preferencias actualizadas</p>
              <h1 className="text-3xl font-semibold tracking-tight">No te enviaremos novedades.</h1>
              <p className="leading-7 text-[#5c5c5c]">Tu decisión quedó registrada. Si vuelves a necesitar información, puedes contactarnos directamente.</p>
            </>
          ) : request ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5c5c5c]">Actualización de preferencias</p>
              <h1 className="text-3xl font-semibold tracking-tight">¿Seguimos en contacto, {firstName}?</h1>
              <p className="leading-7 text-[#5c5c5c]">Confirma si quieres recibir novedades, recursos y comunicaciones de Shades de México.</p>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <form action={confirmRepermissionAction.bind(null, token)} className="flex-1">
                   <button type="submit" className="w-full rounded-lg bg-[#66cdcc] px-4 py-3 text-sm font-semibold text-[#242424] transition-colors hover:bg-[#58bfbe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#242424] focus-visible:ring-offset-2">Sí, quiero recibir novedades</button>
                </form>
                <form action={declineRepermissionAction.bind(null, token)} className="flex-1">
                   <button type="submit" className="w-full rounded-lg border border-[#242424]/30 px-4 py-3 text-sm font-semibold text-[#242424] transition-colors hover:bg-[#242424]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#242424] focus-visible:ring-offset-2">No, gracias</button>
                </form>
              </div>
            </>
          ) : (
            <>
               <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#3f9b9a]">Solicitud no disponible</p>
              <h1 className="text-3xl font-semibold tracking-tight">Este enlace expiró o ya fue utilizado.</h1>
               <p className="leading-7 text-[#5c5c5c]">No necesitas realizar ninguna acción. Si quieres actualizar tus preferencias, contacta al equipo de Shades de México.</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
