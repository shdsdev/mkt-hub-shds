# Design: Unified Select and Dropdown Popups

Add the shadcn Base UI `Select` and give it and the existing `DropdownMenu` one compact, dark, anchored popup treatment. This replaces the selected native controls without changing their submitted data, state behavior, Spanish copy, or keyboard access.

## Quick Path

1. Add the shadcn Base UI `Select` source component without overwriting local component edits.
2. Define shared semantic floating-surface tokens and apply them to `Select` and `DropdownMenu` popups.
3. Migrate the five select migration units plus analytics granularity, then verify form submission and keyboard behavior.

## Scope

| Area | Decision |
| --- | --- |
| Primitive | Add shadcn's Base UI `Select`; do not introduce a custom select primitive or another registry dependency. |
| Visual reference | The external Watermelon registry item is visual reference only. Do not install, copy, or depend on it. |
| Popup treatment | Both `Select` and existing `DropdownMenu` use shared token-based surface, border, radius, padding, shadow, item-focus, animation, and anchor-offset values. No hardcoded theme colors. |
| Popup geometry | Select popups match their trigger width. Dropdown menus retain an explicit local width when one already exists (the sidebar account menu stays `w-64`); otherwise they use anchor width. All remain within available viewport height and use primitive portal positioning. |
| Theme | The compact dark appearance resolves through existing semantic theme tokens such as `--popover`, `--popover-foreground`, and `--border`, so Signature and Midnight remain theme-aware. |

## Migration Units

Five select migration units cover six rendered form/filter hosts; the QR error-correction unit is intentionally shared by the static and website QR forms.

| Unit | Hosts | Preserved behavior |
| --- | --- | --- |
| UTM preset | `app/(protected)/links/link-form.tsx` | Keep the disabled Spanish placeholder and apply the selected preset to the three existing UTM inputs. |
| Short-link domain | `app/(protected)/links/[id]/short-link-form.tsx` | Keep required `domainId` form submission and the first available domain as the effective initial choice. |
| QR error correction | `app/(protected)/qr/static-qr-form.tsx`, `app/(protected)/qr/website-qr-form.tsx` | Keep the controlled `L`/`M`/`Q`/`H` value, `errorCorrectionLevel` submission value, preview updates, and disabled state while a logo is present. |
| QR status filter | `app/(protected)/qr/qr-list.tsx` | Keep the controlled `all`/`active`/`archived` filter and Spanish labels. |
| QR type filter | `app/(protected)/qr/qr-list.tsx` | Keep the controlled `all`/`dynamic`/`static` filter and Spanish labels. |
| Analytics granularity | `app/(protected)/analytics/[linkId]/scans-panel.tsx` | Keep the controlled `day`/`week`/`month` value, Spanish labels, and fetch dependency behavior. |

## Interaction Contract

- Use Base UI Select's accessible trigger, popup, and option semantics rather than re-creating native-select behavior by hand.
- Preserve each control's current value source and update path. State-backed controls keep controlled values and their existing change effects.
- Preserve form semantics: a select used by a server action must continue to submit the same `name` and value. Confirm the Base UI component's form integration; if it does not emit that value, bind one hidden input to the same state rather than changing the action contract.
- Preserve all Spanish labels, placeholders, option text, and validation/error copy.
- Preserve disabled controls and make their trigger non-interactive and visually disabled.
- Support mouse, touch, keyboard focus, Enter/Space opening, arrow-key navigation, selection, Escape dismissal, and focus restoration through Base UI primitives.

## Shared Popup Contract

Define the floating popup style once in `app/globals.css` using semantic custom properties. The Select content and the existing `src/components/ui/dropdown-menu.tsx` content consume those properties rather than duplicating utility strings.

| Token responsibility | Resolution |
| --- | --- |
| Surface and foreground | Existing popover tokens |
| Border and focus treatment | Existing border and accent tokens |
| Shape and density | `--floating-popup-radius: var(--radius-sm)`, `--floating-popup-padding: 4px`, `--floating-popup-item-padding-block: 4px`, `--floating-popup-item-padding-inline: 6px`, and `--floating-popup-offset: 4px` |
| Elevation and motion | A shared semantic shadow token and a `100ms` open/close transition using primitive state and transform-origin |

The current sidebar account menu remains a `DropdownMenu`; only its popup styling is unified. Its trigger content, role label, position above the trigger, and local sidebar edits remain unchanged.

## Safety and Verification

- Inspect shadcn's Select addition with its dry-run/diff workflow before writing generated files. Preserve all local changes; never use overwrite.
- Do not alter unrelated working-tree edits, including the current loaders, tooltips, theme, QR cards, or analytics loading state.
- Verify each migrated form submits the same field names and values as before, including the QR logo-disabled correction selector.
- Verify UTM preset propagation, QR-list filtering, and analytics refetching after selection.
- Verify keyboard navigation, visible focus, Escape, disabled behavior, and mobile-width popup placement.

## Out of Scope

- Replacing date inputs, color inputs, buttons, toggles, or unrelated controls.
- Changing server actions, analytics APIs, option sets, translations, themes, or sidebar information architecture.
- Installing or adopting the Watermelon registry item.

## Review Checklist

- [x] One Base UI Select addition is specified.
- [x] Select and DropdownMenu share a semantic, anchored popup contract.
- [x] Five migration units and analytics granularity have explicit behavior requirements.
- [x] Form values, controlled state, disabled states, Spanish copy, and keyboard access are protected.
- [x] Local edits are explicitly protected and the Watermelon item is reference-only.
