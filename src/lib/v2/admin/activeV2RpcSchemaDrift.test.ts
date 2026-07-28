import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const migration = read(
  "supabase/migrations/20260728214500_fix_active_v2_rpc_schema_drift.sql",
);
const usersFunction = read("supabase/functions/get-all-users/index.ts");
const createUserHandler = read(
  "supabase/functions/get-all-users/handlers/createUserHandler.ts",
);
const updateUserHandler = read(
  "supabase/functions/get-all-users/handlers/updateUserHandler.ts",
);
const confirmUsersFunction = read(
  "supabase/functions/admin-bulk-confirm-users/index.ts",
);
const userService = read(
  "src/pages/admin/components/users/hooks/useUserService.ts",
);
const usersV2Table = read(
  "src/pages/admin/components/users/UsersV2Table.tsx",
);
const createUserDialog = read(
  "src/pages/admin/components/users/components/CreateUserDialog.tsx",
);

describe("active V2 RPC and admin-user schema contracts", () => {
  it("uses promoted V2 resource and product column names", () => {
    expect(migration).toContain("p.title_en");
    expect(migration).toContain("products_page.title_en");
    expect(migration).toContain("rs.title_en");
    expect(migration).toContain("rs.type");
    expect(migration).toContain("r.title_en");
    expect(migration).toContain("r.type AS resource_type_col");
    expect(migration).not.toMatch(/\bpr\.title\b/);
    expect(migration).not.toMatch(/\brs\.title\b/);
    expect(migration).not.toMatch(/\brs\.resource_type\b/);
    expect(migration).not.toMatch(/\br\.title\b/);
  });

  it("pins free acquisition to the explicit latest published version", () => {
    expect(migration).toContain("r.latest_published_version_id");
    expect(migration).toContain("rv.published_at IS NOT NULL");
    expect(migration).toContain(
      "'free_acquisition'::public.v2_grant_reason",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.grant_free_acquisition(uuid)",
    );
  });

  it("routes admin user creation through a JWT-protected Edge Function", () => {
    expect(usersFunction).toContain('if (action === \'create\')');
    expect(usersFunction).toContain("handleCreateUser(supabase, userId");
    expect(userService).toContain(
      "supabase.functions.invoke('get-all-users'",
    );
    expect(userService).toContain("action: 'create'");
    expect(userService).not.toContain("supabase.rpc('admin_create_user'");
  });

  it("creates a real Auth user and assigns authorization from user_roles", () => {
    expect(createUserHandler).toContain("supabase.auth.admin.createUser");
    expect(createUserHandler).toContain("supabase.auth.admin.deleteUser");
    expect(createUserHandler).toContain('.from("user_roles")');
    expect(createUserHandler).toContain('.select("is_super_admin")');
    expect(createUserHandler).toContain("super_admin_required");
    expect(createUserHandler).not.toMatch(
      /@(?:gmail|outlook|hotmail|elzeer)\./i,
    );
  });

  it("retires the orphan-profile RPC and removes Data API execution", () => {
    expect(migration).toContain("'endpoint_retired'");
    expect(migration).toMatch(
      /REVOKE ALL[\s\S]*public\.admin_create_user\(text, text, text, text, text\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/,
    );
    expect(migration).not.toContain("INSERT INTO public.profiles (\n    id,\n    first_name");
  });

  it("reads roles from user_roles in every repaired profile/access function", () => {
    const roleReads = migration.match(/FROM public\.user_roles AS ur/g) ?? [];
    expect(roleReads.length).toBeGreaterThanOrEqual(3);
    expect(migration).not.toContain(
      "SELECT role INTO user_role FROM public.profiles",
    );
    expect(migration).not.toContain("profile_record.role");
  });

  it("keeps the create-user dialog truthful and mobile safe", () => {
    expect(createUserDialog).toContain(
      "Create a confirmed account and assign its initial role.",
    );
    expect(createUserDialog).toContain(
      "grid grid-cols-1 gap-4 sm:grid-cols-2",
    );
    expect(createUserDialog).toContain(
      "flex flex-col-reverse gap-3",
    );
    expect(createUserDialog).not.toContain("receive a welcome email");
  });

  it("serializes role replacement and exposes it only to service_role", () => {
    expect(migration).toContain("admin_set_user_role_v2");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("last_super_admin_cannot_be_demoted");
    expect(migration).toMatch(
      /REVOKE ALL[\s\S]*admin_set_user_role_v2\(uuid, uuid, text\)[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE[\s\S]*admin_set_user_role_v2\(uuid, uuid, text\)[\s\S]*TO service_role/,
    );
  });

  it("keeps user updates on the verified server path", () => {
    expect(usersFunction).toContain("userRole,");
    expect(updateUserHandler).toContain('actorRole !== "admin"');
    expect(updateUserHandler).toContain("actorIsSuperAdmin");
    expect(updateUserHandler).toContain("requestsSensitiveChange");
    expect(updateUserHandler).toContain("admin_set_user_role_v2");
    expect(updateUserHandler).toContain("delete validationBody.action");
    expect(updateUserHandler).not.toMatch(
      /\.from\(["']user_roles["']\)[\s\S]{0,200}\.delete\(/,
    );
    expect(userService).not.toMatch(
      /\.from\(["']user_roles["']\)[\s\S]{0,200}\.(?:insert|delete|update)\(/,
    );
  });

  it("requires a verified super admin for email confirmation", () => {
    expect(confirmUsersFunction).toContain('userRole !== "admin"');
    expect(confirmUsersFunction).toContain('.select("is_super_admin")');
    expect(confirmUsersFunction).toContain("MAX_USERS_PER_REQUEST");
    expect(confirmUsersFunction).not.toContain("onlyWithActiveSubscriptions");
    expect(confirmUsersFunction).not.toContain("startDate");
  });

  it("does not expose the retired resend-confirmation action in Users V2", () => {
    expect(usersV2Table).not.toContain("onResendConfirmation");
    expect(usersV2Table).not.toContain("Resend confirmation");
    expect(usersV2Table).toContain("Send password reset");
  });
});
