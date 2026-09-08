// Public surface of the `users` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  getProfile,
  getAuthUserIdByEmail,
  updateLockoutState,
  createOrganization,
  createProfile,
  isAdmin,
  isActive,
  type Profile,
  type UserRole,
  type UserStatus,
} from "./service";
