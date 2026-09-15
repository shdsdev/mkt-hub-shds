"use client";

import { useMemo } from "react";
import { endOfDay, format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateRangePickerProps = {
  value: DateRange;
  onChange(value: DateRange): void;
  className?: string;
};

type Preset = {
  label: string;
  range: DateRange;
};

function buildPresets(): Preset[] {
  const now = new Date();
  return [
    { label: "7 días", range: { from: subDays(now, 6), to: now } },
    { label: "30 días", range: { from: subDays(now, 29), to: now } },
    { label: "Este mes", range: { from: startOfMonth(now), to: now } },
    { label: "Último trimestre", range: { from: subMonths(startOfMonth(now), 2), to: now } },
    { label: "Último año", range: { from: subMonths(startOfMonth(now), 11), to: now } },
  ];
}

function isSameDay(a: Date | undefined, b: Date | undefined): boolean {
  if (!a || !b) return false;
  return a.toDateString() === b.toDateString();
}

function matchesPreset(value: DateRange, preset: Preset): boolean {
  return isSameDay(value.from, preset.range.from) && isSameDay(value.to, preset.range.to);
}

function rangeLabel(value: DateRange): string {
  if (!value.from || !value.to) return "Seleccionar fechas";
  return `${format(value.from, "dd MMM yyyy")} - ${format(value.to, "dd MMM yyyy")}`;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const presets = useMemo(() => buildPresets(), []);
  const activePresetIndex = presets.findIndex((p) => matchesPreset(value, p));

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" className={cn("justify-start font-normal", className)}>
            <CalendarIcon data-icon="inline-start" />
            {rangeLabel(value)}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-auto p-3">
        <div className="flex flex-wrap gap-1.5 pb-3">
          {presets.map((preset, index) => (
            <Button
              key={preset.label}
              variant={index === activePresetIndex ? "default" : "outline"}
              size="sm"
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => onChange(preset.range)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="border-t border-border pt-3">
          <Calendar
            mode="range"
            selected={value}
            onSelect={(next) => {
              if (next?.from && next.to) onChange({ from: startOfDay(next.from), to: endOfDay(next.to) });
            }}
            numberOfMonths={2}
            className="[--cell-size:--spacing(9)] max-sm:[--cell-size:--spacing(8)] max-sm:[&_.rdp-months]:flex-col"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
