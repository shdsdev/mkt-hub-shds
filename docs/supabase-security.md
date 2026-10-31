# Supabase Security Deployment

Migration `0066_supabase_security` closes direct client access to the 28 application tables reported on 2026-10-31. It also replaces public listing policies on three image buckets with authenticated owner-only reads. Public image URLs remain public. Backend authorization remains in the application, as documented in migration `0014_enable_rls`.

## Deployment Gate

The development `.env` points to local Supabase at ports 55421/55422. Applying the migration there does not fix the hosted project's Security Advisor. Do not copy development keys into production or assume a successful local migration is a production deployment.

1. Integrate the security changes with the target branch. Reconcile migration numbering and the journal if another branch added migrations.
2. Select the intended database through the deployment environment's `DATABASE_URL`. Confirm the project, migration history, backup availability, and the actual application's database role before running migrations.
3. Check the backend role with the following query through its connection. This migration assumes a server role that bypasses RLS. A direct PostgreSQL connection alone does not imply a bypass.

```sql
SELECT current_user, rolbypassrls, rolsuper
FROM pg_roles
WHERE rolname = current_user;
```

4. Check for external clients using PostgREST on these application tables. Those clients will lose access. Marketing Hub uses server-side Drizzle for these tables and Supabase clients for Auth and Storage.
5. Inspect pending migrations, then run `pnpm db:migrate` with the verified deployment connection. Do not run the whole migration journal blindly against an unknown database, edit old migrations, or use `db push` as a substitute. The new migration uses a five-second lock timeout and is transactional through Drizzle.

## Verification

Run `pnpm exec vitest run src/db/security-migrations.test.ts` for the migration coverage guard. It checks every table created in the current journal, including partitions, so new migrations must include explicit RLS enablement.

For real database tests, set `SECURITY_TEST_DATABASE_URL` explicitly to a migrated **local** Supabase database, then run:

```sh
pnpm exec vitest run src/db/security.integration.test.ts --maxWorkers=1
```

These tests deliberately recreate broad grants and storage policies inside rollback-only transactions. They refuse non-local hostnames. Do not point them at hosted databases or run them concurrently with migrations.

After deploying, run these read-only checks in the hosted database:

```sql
-- Should return no tables for the schema represented by this migration journal.
-- Additional tables created by other branches require their own security review.
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND NOT c.relrowsecurity;

-- Should return no old public listing policies.
SELECT policyname, roles, qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'event_landing_images_select_public',
    'qr_logos_select_public',
    'qr_placement_images_select_public'
  );

-- These buckets must stay public for image URLs to work.
SELECT id, public
FROM storage.buckets
WHERE id IN ('event-landing-images', 'qr-logos', 'qr-placement-images');
```

- Verify anonymous and authenticated Data API requests cannot access the protected tables; the integration test checks all table privileges, including TRUNCATE.
- Verify image upload, public image delivery, owner deletion, and lack of cross-owner listing. Existing Storage INSERT and DELETE policies are unchanged. Owner SELECT matches the existing DELETE policies' UUID `owner` field; confirm the deployed Storage version still populates it.
- Smoke-test event registration, check-in, questions/votes, raffles, notifications, and integrations through the application.
- Re-run Security Advisor. The 28 missing-RLS errors and their five overlapping sensitive-column errors should disappear, along with the three broad bucket-listing warnings. This is not a claim that the project's entire security surface has been audited.

RLS-enabled tables without policies are intentionally denied to client roles. Informational `rls_enabled_no_policy` notices may increase after this migration. Do not add permissive policies just to remove those notices.

## Password Protection

Enable leaked-password protection in the hosted project's Auth settings if its plan supports it (Pro and above per current Supabase documentation). This is an Auth configuration change, not a SQL migration. It has not been enabled by this migration.

## Recovery

If migration application fails, Drizzle rolls back its transaction; investigate the reported permission or lock error rather than disabling RLS. If the application fails after deployment, first verify the backend role and connection. Prefer fixing the server connection or a narrowly scoped policy after authorization review. Do not reopen all 28 tables to client roles.

If bucket owner operations fail, verify that objects have a populated `owner` UUID and inspect the existing owner DELETE policy. Only restore a previous Storage policy as a coordinated emergency measure, understanding that a broad SELECT policy re-enables enumeration. Public bucket URLs remain accessible independently of that policy.
