// Public surface of the `users` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  getProfile,
  getAuthUserIdByEmail,
  getEmailByUserId,
  updateLockoutState,
  updateTheme,
  createOrganization,
  getOrganization,
  updateDefaultLogo,
  createProfile,
  isAdmin,
  isActive,
  type Profile,
  type UserRole,
  type UserStatus,
} from "./service";
export { THEMES, VISIBLE_THEMES, DEFAULT_THEME_ID, isValidThemeId, type Theme } from "./theme-registry";
export {
  listManagedUsers,
  changeManagedUserRole,
  setManagedUserStatus,
  setManagedUserTheme,
  deleteManagedUser,
  inviteManagedUser,
  type ManagedUser,
  type ManagedRole,
  type ManagementMutationResult,
  type DeleteManagedUserResult,
  type InviteManagedUserInput,
  type InviteManagedUserResult,
} from "./management";
export {
  getThemeColorOverrides,
  setThemeColorOverride,
  clearThemeColorOverride,
  buildThemeOverrideStyle,
  type ThemeColorOverrideToken,
  type ThemeColorOverrides,
  type SetThemeColorOverrideInput,
  type SetThemeColorOverrideResult,
  type ClearThemeColorOverrideInput,
  type ClearThemeColorOverrideResult,
} from "./theme-overrides";
