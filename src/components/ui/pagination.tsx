import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide";
import { buttonVariants } from "@/components/ui/button";
import { HoverMorphIcon } from "@/components/hover-morph-icon";
import { cn } from "@/lib/utils";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav data-slot="pagination" aria-label="Paginación" className={cn("flex w-full justify-center", className)} {...props} />;
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="pagination-content" className={cn("flex items-center gap-1", className)} {...props} />;
}

function PaginationItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" className={className} {...props} />;
}

function PaginationLink({ className, isActive, ...props }: React.ComponentProps<"a"> & { isActive?: boolean }) {
  return (
    <a
      data-slot="pagination-link"
      aria-current={isActive ? "page" : undefined}
      className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size: "icon-sm" }), className)}
      {...props}
    />
  );
}

function PaginationFirst(props: React.ComponentProps<typeof PaginationLink>) {
  return <PaginationLink aria-label="Ir a la primera página" {...props}><HoverMorphIcon idle={ChevronsLeft} active={ChevronLeft} /></PaginationLink>;
}

function PaginationPrevious(props: React.ComponentProps<typeof PaginationLink>) {
  return <PaginationLink aria-label="Ir a la página anterior" {...props}><HoverMorphIcon idle={ChevronLeft} active={ChevronsLeft} /></PaginationLink>;
}

function PaginationNext(props: React.ComponentProps<typeof PaginationLink>) {
  return <PaginationLink aria-label="Ir a la página siguiente" {...props}><HoverMorphIcon idle={ChevronRight} active={ChevronsRight} /></PaginationLink>;
}

function PaginationLast(props: React.ComponentProps<typeof PaginationLink>) {
  return <PaginationLink aria-label="Ir a la última página" {...props}><HoverMorphIcon idle={ChevronsRight} active={ChevronRight} /></PaginationLink>;
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="pagination-ellipsis" aria-hidden="true" className={cn("flex size-7 items-center justify-center text-muted-foreground", className)} {...props}>...</span>;
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationFirst,
  PaginationPrevious,
  PaginationNext,
  PaginationLast,
  PaginationEllipsis,
};
