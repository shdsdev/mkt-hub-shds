"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LoaderCircle, Search, X } from "lucide-react";
import type { EventRegistrationRow } from "@/modules/events";
import { getOccupationPresentation } from "@/lib/events/occupation-presentation";
import { MEXICAN_STATES } from "@/lib/events/mexican-states";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REVIEW_STATUS_LABELS } from "./review-status";

const OCCUPATION_FILTER_OPTIONS = ["wholesaler", "manufacturer", "architect-decorator", "installer-technician"] as const;
const SOURCE_FILTER_OPTIONS = ["Meta Ads", "Sitio web", "facebook", "instagram", "google", "Admin", "Sin atribución"] as const;
type SortOption = "recent" | "oldest" | "name" | "company";

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Más recientes",
  oldest: "Más antiguos",
  name: "Nombre",
  company: "Empresa",
};

type Props = {
  status?: EventRegistrationRow["status"];
  q?: string;
  reviewStatus?: string;
  source?: string;
  occupation?: string;
  state?: string;
  sort: SortOption;
  pageSize: number;
};

type FilterKey = "status" | "q" | "reviewStatus" | "source" | "occupation" | "state";
type NavigationKey = FilterKey | "sort" | "pageSize";

export function RegistrationFilters({
  status,
  q,
  reviewStatus,
  source,
  occupation,
  state,
  sort,
  pageSize,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState(q ?? "");
  const [isPending, startNavigation] = useTransition();
  const skipSearchEffectRef = useRef(false);
  const lastNavigatedQueryRef = useRef<string | null>(null);

  useEffect(() => setQuery(q ?? ""), [q]);

  const navigate = useCallback((changes: Partial<Record<NavigationKey, string | undefined>>) => {
    const values = {
      status,
      q: query.trim() || undefined,
      reviewStatus,
      source,
      occupation,
      state,
      sort,
      pageSize: String(pageSize),
      ...changes,
      page: undefined,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
    }
    startNavigation(() => router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`, { scroll: false }));
  }, [occupation, pageSize, pathname, reviewStatus, router, source, sort, state, startNavigation, status, query]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery === (q ?? "")) return;
    if (normalizedQuery === lastNavigatedQueryRef.current) {
      lastNavigatedQueryRef.current = null;
      return;
    }
    if (skipSearchEffectRef.current) {
      skipSearchEffectRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      lastNavigatedQueryRef.current = normalizedQuery;
      navigate({ q: normalizedQuery || undefined });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [navigate, q, query]);

  const hasFilters = Boolean(query.trim() || status || reviewStatus || source || occupation || state);
  const isUpdating = isPending || query.trim() !== (q ?? "");

  function updateFilter(key: NavigationKey, value?: string) {
    if (key === "q") return;
    navigate({ [key]: value });
  }

  function clearFilters() {
    skipSearchEffectRef.current = true;
    setQuery("");
    navigate({
      status: undefined,
      q: undefined,
      reviewStatus: undefined,
      source: undefined,
      occupation: undefined,
      state: undefined,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid w-full grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(140px,auto))_auto]">
        <label className="relative min-w-0 sm:col-span-2 xl:col-span-1">
          <span className="sr-only">Buscar nombre, correo o empresa</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            name="q"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar nombre, correo o empresa…"
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-9 outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Revisión</span>
          <Select value={reviewStatus ?? "all"} onValueChange={(value) => updateFilter("reviewStatus", value === "all" ? undefined : value ?? undefined)}>
            <SelectTrigger className="h-10 w-full min-w-0" aria-label="Filtrar por revisión"><SelectValue>{reviewStatus ? REVIEW_STATUS_LABELS[reviewStatus as keyof typeof REVIEW_STATUS_LABELS] : "Todas las revisiones"}</SelectValue></SelectTrigger>
            <SelectContent><SelectGroup>
              <SelectItem value="all">Todas las revisiones</SelectItem>
              {Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectGroup></SelectContent>
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-medium text-muted-foreground">Fuente</span><Select value={source ?? "all"} onValueChange={(value) => updateFilter("source", value === "all" ? undefined : value ?? undefined)}><SelectTrigger className="h-10 w-full min-w-0" aria-label="Filtrar por fuente"><SelectValue>{source ?? "Todas las fuentes"}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">Todas las fuentes</SelectItem>{SOURCE_FILTER_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectGroup></SelectContent></Select></label>
        <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-medium text-muted-foreground">Actividad</span><Select value={occupation ?? "all"} onValueChange={(value) => updateFilter("occupation", value === "all" ? undefined : value ?? undefined)}><SelectTrigger className="h-10 w-full min-w-0" aria-label="Filtrar por actividad"><SelectValue>{occupation ? getOccupationPresentation(occupation).label : "Todas las actividades"}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">Todas las actividades</SelectItem>{OCCUPATION_FILTER_OPTIONS.map((value) => <SelectItem key={value} value={value}>{getOccupationPresentation(value).label}</SelectItem>)}</SelectGroup></SelectContent></Select></label>
        <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-medium text-muted-foreground">Estado</span><Select value={state ?? "all"} onValueChange={(value) => updateFilter("state", value === "all" ? undefined : value ?? undefined)}><SelectTrigger className="h-10 w-full min-w-0" aria-label="Filtrar por estado"><SelectValue>{state ? MEXICAN_STATES.find((item) => item.value === state)?.label : "Todos los estados"}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">Todos los estados</SelectItem>{MEXICAN_STATES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select></label>
        <AnimatePresence initial={false}>
          {hasFilters ? (
            <motion.button
              type="button"
              aria-label="Limpiar filtros"
              title="Limpiar filtros"
              onClick={clearFilters}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              className="inline-flex h-10 items-center justify-center rounded-md border border-border px-3 text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="size-4" aria-hidden="true" />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="registration-sort" className="text-muted-foreground">Ordenar</label>
          <Select value={sort} onValueChange={(value) => value && updateFilter("sort", value)}>
            <SelectTrigger id="registration-sort" className="h-9 min-w-36" aria-label="Ordenar registros"><SelectValue>{SORT_LABELS[sort]}</SelectValue></SelectTrigger>
            <SelectContent><SelectGroup>
              <SelectItem value="recent">{SORT_LABELS.recent}</SelectItem>
              <SelectItem value="oldest">Más antiguos</SelectItem>
              <SelectItem value="name">Nombre</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
            </SelectGroup></SelectContent>
          </Select>
          <label htmlFor="registration-page-size" className="text-muted-foreground">Mostrar</label>
          <Select value={String(pageSize)} onValueChange={(value) => value && updateFilter("pageSize", value)}>
            <SelectTrigger id="registration-page-size" className="h-9 min-w-20" aria-label="Registros por página"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              {[25, 50, 100].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
            </SelectGroup></SelectContent>
          </Select>
        </div>
        <AnimatePresence initial={false}>
          {isUpdating ? (
            <motion.span
              className="inline-flex items-center gap-2 text-xs text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-live="polite"
            >
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              Actualizando resultados…
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
