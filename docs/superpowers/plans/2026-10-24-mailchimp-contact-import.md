# Mailchimp Contact Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make contact imports compatible with the supplied Mailchimp CSV and clarify the import flow as select, review, and confirm.

**Architecture:** Extend the pure CSV parser with header aliases and normalized multi-value tags while preserving unknown columns as attributes. Keep the server action unchanged, add a static downloadable template route, and make the client form expose explicit review and confirmation states.

**Tech Stack:** React, Next.js App Router, TypeScript, Vitest, Tailwind CSS.

## Global Constraints

- `email` and Mailchimp `Email Address` are accepted as the required email column.
- `First Name` and `Last Name` are combined into `fullName`.
- Comma-separated tags become individual tag names.
- Unknown non-empty columns remain contact attributes.
- Importing does not grant consent or reactivate unsubscribed/suppressed contacts.
- The UI must not show a second import action before a valid preview exists.

---

### Task 1: Parser and template

**Files:**
- Modify: `src/lib/email-contact-import.ts`
- Modify: `src/lib/email-contact-import.test.ts`
- Create: `app/(protected)/email-marketing/contacts/template/route.ts`

- [x] Accept current and Mailchimp header aliases.
- [x] Combine first and last name fields.
- [x] Split and normalize comma-separated tags.
- [x] Preserve address, birthday, and custom questions as attributes.
- [x] Return a UTF-8 CSV template with the supported application headers.

### Task 2: Import flow UI

**Files:**
- Modify: `app/(protected)/email-marketing/contacts/import-contacts-form.tsx`

- [x] Start with one `Seleccionar CSV` action and a `Descargar plantilla CSV` link.
- [x] Show filename and preview summary only after selection.
- [x] Show valid rows, errors, and a small data preview before importing.
- [x] Reveal `Importar N contactos` only when valid rows exist.
- [x] Allow changing the file without exposing two competing primary buttons.
- [x] Explain that import does not create consent.

### Task 3: Verification

- [x] Run the parser tests.
- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test` (one pre-existing event UI test timed out; parser and 166 other files passed).
