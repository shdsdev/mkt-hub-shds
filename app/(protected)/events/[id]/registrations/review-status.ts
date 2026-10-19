import type { EventRegistrationRow } from "@/modules/events";

export type ReviewStatus = EventRegistrationRow["reviewStatus"];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  new: "Nuevo",
  in_review: "En revisión",
  approved: "Aprobado",
  waitlisted: "Lista de espera",
  rejected: "Rechazado",
};
