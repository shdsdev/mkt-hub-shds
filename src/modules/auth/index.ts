// Public surface of the `auth` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  signIn,
  signOut,
  getCurrentUser,
  type SignInResult,
  type CurrentUser,
} from "./service";
