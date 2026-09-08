// Creates the first ADMIN user. Internal tool — no public sign-up (SPEC.md §18); every other
// user is created by an ADMIN from inside the app once this one exists.
//
// Usage: pnpm db:seed -- --email you@example.com --password "at-least-12-chars" --org "My Org"
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrganization, createProfile } from "@/modules/users";

function readArg(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index !== -1 ? process.argv[index + 1] : undefined;
  if (!value) {
    throw new Error(`Missing required --${name} argument.`);
  }
  return value;
}

async function main() {
  const email = readArg("email");
  const password = readArg("password");
  const orgName = readArg("org");

  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create Supabase auth user: ${error?.message}`);
  }

  try {
    const org = await createOrganization(orgName);
    await createProfile({ id: data.user.id, organizationId: org.id, role: "ADMIN" });
    console.log(`Created ADMIN ${email} in organization "${orgName}" (${org.id}).`);
  } catch (dbError) {
    // Roll back the auth user rather than leaving an orphan with no profile.
    await admin.auth.admin.deleteUser(data.user.id);
    throw dbError;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
