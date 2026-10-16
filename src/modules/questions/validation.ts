import { z } from "zod";

export const QUESTION_MAX_LENGTH = 500;

export const questionTextSchema = z
  .string()
  .trim()
  .min(1, "La pregunta no puede estar vacía.")
  .max(QUESTION_MAX_LENGTH, `La pregunta no puede superar los ${QUESTION_MAX_LENGTH} caracteres.`);

export const questionParticipantSchema = z.object({
  fullName: z.string().trim().min(1, "Ingresá tu nombre completo.").max(255),
  company: z.string().trim().min(1, "Ingresá tu empresa.").max(255),
  consentAccepted: z.literal(true, "Debés aceptar el tratamiento de datos para continuar."),
});

export type QuestionParticipantInput = z.infer<typeof questionParticipantSchema>;
