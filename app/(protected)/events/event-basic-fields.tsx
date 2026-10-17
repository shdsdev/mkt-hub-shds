"use client";

import { useState } from "react";
import { Checkbox } from "@/components/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock3Icon, XIcon } from "lucide-react";
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
  autoSlug?: boolean;
};

const timeOptions = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "00" : "30"}`);

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

function formatDate(value: Date | undefined) {
  if (!value) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function DateField({ label, value, onChange, optional = false, name, buttonLabel }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean; name: string; buttonLabel?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <div className="flex gap-2">
        <Input name={name} type="text" inputMode="numeric" placeholder="AAAA-MM-DD" value={value} required={!optional} aria-label={label} onChange={(event) => onChange(event.target.value)} />
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="outline" size="icon" aria-label={buttonLabel ?? `Seleccionar ${label.toLowerCase()}`}><CalendarIcon /></Button>} />
          <PopoverContent align="start" className="w-auto p-3">
            <Calendar mode="single" selected={parseDate(value)} onSelect={(date) => onChange(formatDate(date))} />
            {optional ? <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}><XIcon /> Limpiar</Button> : null}
          </PopoverContent>
        </Popover>
      </div>
    </label>
  );
}

function TimeField({ label, value, onChange, optional = false, name }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <div className="flex gap-2">
        <Input name={name} type="text" inputMode="numeric" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" value={value} required={!optional} aria-label={label} onChange={(event) => onChange(event.target.value)} />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button type="button" variant="outline" size="icon" aria-label={`Seleccionar ${label.toLowerCase()}`}><Clock3Icon /></Button>} />
          <PopoverContent align="start" className="w-64 p-3">
            <div className="grid grid-cols-4 gap-1.5" role="listbox" aria-label={label}>
              {timeOptions.map((option) => <Button key={option} type="button" data-time-option="true" variant={value === option ? "default" : "outline"} size="sm" onClick={() => { onChange(option); setOpen(false); }}>{option}</Button>)}
            </div>
            {optional ? <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => { onChange(""); setOpen(false); }}><XIcon /> Limpiar</Button> : null}
          </PopoverContent>
        </Popover>
      </div>
    </label>
  );
}

export function EventBasicFields({
  event,
  checkInConfirmationRequired,
  onCheckInConfirmationRequiredChange,
  autoSlug = false,
}: EventBasicFieldsProps) {
  const editing = Boolean(event);
  const [name, setName] = useState(event?.name ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(event?.slug));
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
        <Input
          name="name"
          required={!editing}
          value={editing ? undefined : name}
          defaultValue={editing ? event?.name : undefined}
          maxLength={255}
          onChange={
            editing
              ? undefined
              : (changeEvent) => {
                  const nextName = changeEvent.target.value;
                  setName(nextName);
                  if (autoSlug && !slugEdited) {
                    setSlug(
                      nextName
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, ""),
                    );
                  }
                }
          }
        />
      </label>
      {!editing ? (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Slug
          <Input
            name="slug"
            required
            maxLength={255}
            pattern="[a-z0-9-]+"
            value={autoSlug ? slug : undefined}
            onChange={autoSlug ? (changeEvent) => { setSlugEdited(true); setSlug(changeEvent.target.value); } : undefined}
          />
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
        <DateField label="Fecha del evento" buttonLabel="Seleccionar fecha de inicio" name="startDate" value={startDate} onChange={setStartDate} />
        <TimeField label="Hora de inicio" name="startTime" value={startTime} onChange={setStartTime} />
        <DateField label="Fecha de finalización (opcional)" name="endDate" value={endDate} onChange={setEndDate} optional />
        <TimeField label="Hora de finalización (opcional)" name="endTime" value={endTime} onChange={setEndTime} optional />
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
