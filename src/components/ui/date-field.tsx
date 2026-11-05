"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, XIcon } from "lucide-react";

export function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

export function formatDateInput(value: Date | undefined) {
  if (!value) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

type DateFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  buttonLabel?: string;
  className?: string;
};

export function DateField({ label, name, value, onChange, optional = false, buttonLabel, className }: DateFieldProps) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5 text-sm font-medium", className)}>
      {label}
      <div className="flex gap-2">
        <Input
          name={name}
          type="text"
          inputMode="numeric"
          placeholder="AAAA-MM-DD"
          value={value}
          required={!optional}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        />
        <Popover>
          <PopoverTrigger
            render={
              <Button type="button" variant="outline" size="icon" aria-label={buttonLabel ?? `Seleccionar ${label.toLowerCase()}`}>
                <CalendarIcon />
              </Button>
            }
          />
          <PopoverContent align="start" className="w-auto p-3">
            <Calendar mode="single" selected={parseDateInput(value)} onSelect={(date) => onChange(formatDateInput(date))} />
            {optional ? <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}><XIcon /> Limpiar</Button> : null}
          </PopoverContent>
        </Popover>
      </div>
    </label>
  );
}
