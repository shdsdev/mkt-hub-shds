# User Theme Toggle Design

## Goal

Allow `MARKETING_USER`, `EVENT_EDITOR`, and `RECEPTION` users to switch between the existing `light` and `dark` themes from the profile dropdown. `ADMIN` users get the same quick toggle while retaining access to every existing theme in Settings.

## Current Context

- User theme preferences are stored in `users.theme`.
- `app/layout.tsx` resolves the stored theme and applies the theme class, data attribute, aura background, and color overrides.
- `updateUserThemeAction` currently allows only `ADMIN` to update a theme.
- The profile dropdown lives in `app/(protected)/sidebar.tsx`.
- The theme registry already defines `light`, `dark`, and the additional curated themes.

## User Experience

Add one item to the existing profile dropdown:

- When the current theme is light, show `Cambiar a modo oscuro` with a moon icon.
- When the current theme is dark, show `Cambiar a modo claro` with a sun icon.
- Submit the target base theme through the existing server action.
- Keep the current profile card, Settings link, and sign-out behavior unchanged.
- The item is available to every active authenticated role.

For non-admin roles, the quick toggle is the only theme selection available and accepts only `light` or `dark`.

For `ADMIN`, the quick toggle targets the opposite base mode. If the admin is currently using a special dark theme, the action changes to `light`; if the admin is using a light theme, it changes to `dark`. The special themes remain available in Settings and are not removed or changed.

## Authorization And Data Flow

1. `ProtectedLayout` passes the current stored theme to `AppSidebar` together with the email and role.
2. `AppSidebar` derives the current mode from the theme registry and renders the opposite target theme in the dropdown item.
3. The dropdown submits a server action with the target theme ID.
4. The server action authenticates the user, applies the role rule, validates the theme ID, updates `users.theme`, and revalidates the root layout.
5. The next render applies the new theme globally through the existing root layout behavior.

The server action remains the security boundary. Client-rendered labels and hidden form values are not trusted.

## Authorization Rules

- `ADMIN`: may update to any valid registered theme.
- `MARKETING_USER`: may update only to `light` or `dark`.
- `EVENT_EDITOR`: may update only to `light` or `dark`.
- `RECEPTION`: may update only to `light` or `dark`.
- Any unauthenticated or inactive user is rejected using the existing authentication behavior.

## Implementation Scope

- Update `app/(protected)/layout.tsx` to pass the current theme.
- Update `app/(protected)/sidebar.tsx` to render the quick toggle and its icon.
- Update `app/(protected)/settings/actions.ts` to enforce the role-based theme allowlist.
- Add focused tests for action authorization and target theme behavior.
- Preserve the existing Settings theme picker and admin-only color editor.

## Alternatives Rejected

### Client-only localStorage toggle

Rejected because it would not persist across devices, would diverge from the existing per-user preference model, and would not provide a server authorization boundary.

### Full theme submenu in the profile dropdown

Rejected because it duplicates the Settings picker and makes the requested quick action less direct.

## Verification

- Unit tests cover allowed roles, rejected special themes for non-admin roles, and unrestricted valid themes for `ADMIN`.
- Typecheck and lint must pass.
- The existing theme registry and Settings tests must remain green.
- Manual check: switch themes from the profile dropdown as each supported role and confirm the visual theme updates after the action completes.

## Rollback Boundary

Reverting the implementation changes restores the current admin-only theme action and removes only the quick profile-dropdown control. Existing theme definitions, Settings controls, and stored preferences remain intact.
