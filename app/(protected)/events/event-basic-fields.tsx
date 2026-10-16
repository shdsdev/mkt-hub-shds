"use client";

import { useState } from "react";
import { Checkbox } from "@/components/checkbox";
import { Input } from "@/components/ui/input";
import {
  combineDateTimeLocal,
  combineOptionalDateTimeLocal,
  getOptionalDateTimeError,
  splitDateTimeLocal,
} from "@/lib/events/event-date-time";
import type { EventRow } from "@/modules/events";

type EventBasicFieldsProps = {
  event?: Pick<
    EventRow,
    | "name"
    | "slug"
    | "startsAt"
    | "endsAt"
    | "location"
    | "locationUrl"
    | "capacity"
  >;
  checkInConfirmationRequired?: boolean;
  onCheckInConfirmationRequiredChange?: (checked: boolean) => void;
};

export function EventBasicFields({
  event,
  checkInConfirmationRequired,
  onCheckInConfirmationRequiredChange,
}: EventBasicFieldsProps) {
  const editing = Boolean(event);
  const initialStart = splitDateTimeLocal(event?.startsAt ?? null);
  const initialEnd = splitDateTimeLocal(event?.endsAt ?? null);
  const [startDate, setStartDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endDate, setEndDate] = useState(initialEnd.date);
  const [endTime, setEndTime] = useState(initialEnd.time);
  const endDateTimeError = getOptionalDateTimeError(endDate, endTime);
  const startsAt = startDate && startTime ? combineDateTimeLocal(startDate, startTime) : "";
  const endsAt = endDateTimeError ? "" : combineOptionalDateTimeLocal(endDate, endTime);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nombre
        <Input name="name" required={!editing} defaultValue={event?.name} maxLength={255} />
      </label>
      {!editing ? (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Slug
          <Input name="slug" required maxLength={255} pattern="[a-z0-9\-]+" />
        </label>
      ) : null}
      {onCheckInConfirmationRequiredChange ? (
        <div className="sm:col-span-2">
          <Checkbox
            checked={checkInConfirmationRequired ?? false}
            onChange={onCheckInConfirmationRequiredChange}
            label="Pedir confirmación antes de registrar entrada"
            name="checkInConfirmationRequired"
            value="true"
          />
          <input type="hidden" name="checkInConfirmationRequired" value="false" />
        </div>
      ) : null}
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Fecha del evento
          <Input
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Hora de inicio
          <Input
            name="startTime"
            type="time"
            required
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Fecha de finalización (opcional)
          <Input
            name="endDate"
            type="date"
            value={endDate}
            aria-invalid={Boolean(endDateTimeError)}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Hora de finalización (opcional)
          <Input
            name="endTime"
            type="time"
            value={endTime}
            aria-invalid={Boolean(endDateTimeError)}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Usá la finalización sólo si el evento tiene una hora de cierre definida.
        </p>
        {endDateTimeError ? (
          <p className="text-sm text-destructive sm:col-span-2" role="alert">
            {endDateTimeError}
          </p>
        ) : null}
        <input type="hidden" name="startsAt" value={startsAt} />
        <input type="hidden" name="endsAt" value={endsAt} />
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Ubicación del evento
        <Input name="location" defaultValue={event?.location ?? ""} maxLength={255} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Liga directa de Google Maps (opcional)
        <Input name="locationUrl" type="url" defaultValue={event?.locationUrl ?? ""} maxLength={2000} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Capacidad (opcional, vacío = ilimitada)
        <Input name="capacity" type="number" min={1} defaultValue={event?.capacity ?? ""} />
      </label>
    </div>
  );
}
