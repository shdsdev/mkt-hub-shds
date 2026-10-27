# Protected Responsive Layout Design

## Goal

Make the protected event and settings surfaces usable at iPad Pro (`1032px`) and iPad Mini (`768px`) widths without horizontal page overflow or loss of information hierarchy.

## Decisions

- Registration cards remain phone-only. Tablet widths use a compact table with an internal horizontal scroll container.
- The table keeps the most useful operational fields visible and preserves row selection/detail-sheet behavior.
- Event dashboard switches to a single vertical content flow below `xl`; metric tiles use two columns on tablet and one column on phone.
- Event sub-navigation owns its horizontal scrolling and never expands the page viewport.
- Settings users keep a table, but invitation controls, search, and filters wrap into bounded rows at tablet widths.
- Existing colors, typography, labels, permissions, links, and data contracts remain unchanged.

## Surfaces

### Registrations

Use the existing table below `xl` and above `sm`, with a reduced column set suitable for tablet. Keep cards below `sm`. Remove the visually heavy metadata block from cards and replace it with a compact two-column definition grid.

### Dashboard

Use `grid-cols-2` metrics below `xl`, then `grid-cols-1` below `sm`. Stack the activity, recent registrations, attention, and status sections below `xl`. Constrain chart content with `min-w-0`.

### Event Navigation

Apply `max-w-full`, `overflow-x-auto`, and `overscroll-x-contain` to the nav viewport. Keep the tab row `w-max` and use a smaller tablet gap/padding so all tabs remain reachable without clipping the page.

### Users

At tablet widths, stack the invitation form fields and wrap the list toolbar. Keep the users table in an internal scroll viewport and avoid fixed widths on the outer settings content.

## Verification

- Focused tests for registrations, dashboard, event navigation, and users.
- `pnpm lint`.
- `pnpm typecheck`.
- `pnpm build`.
- Manual checks at `1032x1376` and `768x1024` for no document-level horizontal overflow.
