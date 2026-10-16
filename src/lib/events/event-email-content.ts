import { z } from "zod";

export const eventEmailContentSchema = z.object({
  version: z.literal(1),
  confirmationIntro: z.string().trim().max(1000),
  reminderIntro: z.string().trim().max(1000),
  logistics: z.string().trim().max(2000),
  benefit: z.string().trim().max(2000),
});

export type EventEmailContent = z.infer<typeof eventEmailContentSchema>;

export function getDefaultEventEmailContent(): EventEmailContent {
  return {
    version: 1,
    confirmationIntro: "Nos encantará recibirte en una experiencia diseñada para aprender, descubrir nuevas soluciones y conectar con otros profesionales de la industria.",
    reminderIntro: "Prepárate para aprender, descubrir nuevas soluciones y conectar con especialistas de nuestra industria.",
    logistics: "Te recomendamos llegar con anticipación para tu registro y revisar desde ahora cómo llegar al evento.",
    benefit: "Valida tu QR al ingresar y consulta en las mesas de venta los beneficios disponibles para asistentes.",
  };
}

export function resolveEventEmailContent(value: unknown): EventEmailContent {
  const parsed = eventEmailContentSchema.safeParse(value);
  return parsed.success ? parsed.data : getDefaultEventEmailContent();
}
