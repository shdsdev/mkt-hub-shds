# QR Navigation and Trash Implementation Plan

**Goal:** Organize QR codes through a compact sidebar and support reversible deletion that blocks dynamic scans.

**Architecture:** Keep trash independent of resource status using `deletedAt`. Reuse URL-backed filters and the existing modal/select components. Guard scans by the exact short-link/organization pair without disabling shared links.

**Tech Stack:** Next.js 16.3.4, React 19, Drizzle/PostgreSQL, Base UI, Vitest, Playwright CLI.

## Completed Work

- [x] Add failing lifecycle, redirect, query, page, and interactive UI tests before implementation.
- [x] Add soft-delete migration, scoped delete/restore services and server actions, counts, and trash filtering.
- [x] Block deleted dynamic QR scans before analytics with a non-cacheable 410 response.
- [x] Replace group tabs with desktop/sidebar and mobile/sheet navigation.
- [x] Add confirmation dialogs, pending/error/success states, and restore actions in both layouts.
- [x] Run TypeScript, changed-source ESLint, the full Vitest suite, and production build.
- [x] Apply migration with the repository migration command.

## Remaining Verification

- [ ] Inspect the authenticated QR screen in Playwright on desktop and mobile. The available browser session reaches the login screen, so this visual check is not claimed as completed.

## Boundaries

Do not permanently delete QR or analytics records, change static printed payloads, disable shared ordinary links, introduce native replacements for premium selects, or change unrelated workspace edits. No commit or push is part of this work.
