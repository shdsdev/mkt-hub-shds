import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers } from "@/db/auth-schema-ref";
import { users, organizations, userRole, userStatus } from "./db";

export type UserRole = (typeof userRole.enumValues)[number];
export type UserStatus = (typeof userStatus.enumValues)[number];

export type Profile = typeof users.$inferSelect;

export async function getProfile(userId: string): Promise<Profile | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0];
}

// Resolves an email to its Supabase auth.users id, purely to key the account-lockout check
// before attempting Supabase sign-in. Returns undefined for an unknown email — no lockout state
// is tracked or created for accounts that don't exist.
export async function getAuthUserIdByEmail(email: string): Promise<string | undefined> {
  const rows = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, email))
    .limit(1);
  return rows[0]?.id;
}

export async function getEmailByUserId(userId: string): Promise<string | undefined> {
  const rows = await db
    .select({ email: authUsers.email })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .limit(1);
  return rows[0]?.email ?? undefined;
}

export async function updateLockoutState(
  userId: string,
  state: { failedLoginAttempts: number; lockedUntil: Date | null },
): Promise<void> {
  await db.update(users).set(state).where(eq(users.id, userId));
}

export async function updateTheme(userId: string, themeId: string): Promise<void> {
  await db.update(users).set({ theme: themeId }).where(eq(users.id, userId));
}

export async function createOrganization(name: string) {
  const [org] = await db.insert(organizations).values({ name }).returning();
  return org;
}

export async function createProfile(input: {
  id: string;
  organizationId: string;
  role: UserRole;
}): Promise<Profile> {
  const [profile] = await db.insert(users).values(input).returning();
  return profile;
}

// Coarse MVP gate (SPEC.md §19) — ADMIN vs. everyone else. Granular per-role permissions are
// Phase 2.
export function isAdmin(profile: Pick<Profile, "role">): boolean {
  return profile.role === "ADMIN";
}

export function isActive(profile: Pick<Profile, "status">): boolean {
  return profile.status === "active";
}
