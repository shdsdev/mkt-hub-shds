import { describe, expect, it } from "vitest";
import { asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { authUsers } from "../../db/auth-schema-ref";
import { users } from "./db";

// Regression guard for the ambiguous-table bug that broke Settings > Users and invitations:
// joining the public `users` table to `auth.users` produces two SQL tables both named `users`.
// The query must alias the public table so every reference is unambiguous.
describe("managed-user query SQL", () => {
  it("joins public users to auth users with a distinct table alias", () => {
    const db = drizzle({} as never);
    const profileUsers = alias(users, "profile_users");

    const { sql: listSql } = db
      .select({
        id: profileUsers.id,
        organizationId: profileUsers.organizationId,
        role: profileUsers.role,
        status: profileUsers.status,
        createdAt: profileUsers.createdAt,
        email: sql<string>`coalesce(${authUsers.email}, '')`,
      })
      .from(profileUsers)
      .innerJoin(authUsers, eq(profileUsers.id, authUsers.id))
      .where(eq(profileUsers.organizationId, "org-1"))
      .orderBy(asc(authUsers.email))
      .toSQL();

    expect(listSql).toContain('from "users" "profile_users"');
    expect(listSql).toContain('inner join "auth"."users" on "profile_users"."id"');
    expect(listSql).toContain('where "profile_users"."organization_id"');
    expect(listSql).not.toMatch(/inner join "auth"\."users" on "users"\."id"/);
  });

  it("renders a scoped target lookup with the alias", () => {
    const db = drizzle({} as never);
    const profileUsers = alias(users, "profile_users");

    const { sql: targetSql } = db
      .select({ id: profileUsers.id })
      .from(profileUsers)
      .innerJoin(authUsers, eq(profileUsers.id, authUsers.id))
      .where(eq(profileUsers.id, "target-1"))
      .limit(1)
      .toSQL();

    expect(targetSql).toContain('from "users" "profile_users"');
    expect(targetSql).toContain('on "profile_users"."id" = "auth"."users"."id"');
  });
});