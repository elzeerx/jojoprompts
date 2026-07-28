import { createClient, corsHeaders } from "../../_shared/standardImports.ts";
import { createEdgeLogger } from "../../_shared/logger.ts";
import {
  logAdminAction,
  logSecurityEvent,
} from "../../shared/securityLogger.ts";

const logger = createEdgeLogger("get-all-users:create-user");
const ALLOWED_ROLES = new Set(["user", "admin", "prompter", "jadmin"]);
const PRIVILEGED_ROLES = new Set(["admin", "prompter", "jadmin"]);

type AdminClient = ReturnType<typeof createClient>;

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(
  source: Record<string, unknown>,
  key: string,
): string {
  return typeof source[key] === "string"
    ? source[key].trim()
    : "";
}

function safeUsername(email: string, userId: string): string {
  const localPart = email.split("@")[0] ?? "user";
  const normalized = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return `${normalized || "user"}_${userId.slice(0, 8)}`;
}

/**
 * Creates a real Auth user, a V2 profile, and a user_roles row as one
 * compensating workflow. Privileged roles require the actor's explicit
 * is_super_admin flag; no email address is treated as authority.
 */
export async function handleCreateUser(
  supabase: AdminClient,
  adminId: string,
  requestBody: unknown,
): Promise<Response> {
  const body = asRecord(requestBody);
  const email = stringValue(body, "email").toLowerCase();
  const password = stringValue(body, "password");
  const firstName = stringValue(body, "first_name") || "User";
  const lastName = stringValue(body, "last_name");
  const role = stringValue(body, "role") || "user";
  const ipAddress = stringValue(body, "ip_address") || "unknown";
  const userAgent = stringValue(body, "user_agent") || "unknown";

  if (!email || !email.includes("@") || !password) {
    return jsonResponse(
      {
        error: "missing_required_fields",
        details: "A valid email and password are required.",
      },
      400,
    );
  }

  if (password.length < 8) {
    return jsonResponse(
      {
        error: "password_too_short",
        details: "Password must contain at least 8 characters.",
      },
      400,
    );
  }

  if (!ALLOWED_ROLES.has(role)) {
    return jsonResponse(
      { error: "invalid_role", details: "The requested role is not valid." },
      400,
    );
  }

  if (PRIVILEGED_ROLES.has(role)) {
    const { data: actorRole, error: actorRoleError } = await supabase
      .from("user_roles")
      .select("is_super_admin")
      .eq("user_id", adminId)
      .eq("role", "admin")
      .maybeSingle();

    if (actorRoleError || actorRole?.is_super_admin !== true) {
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: "unauthorized_privileged_user_creation_attempt",
        details: {
          attempted_role: role,
          target_email: email,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return jsonResponse(
        {
          error: "super_admin_required",
          details: "Only a super admin may assign a privileged role.",
        },
        403,
      );
    }
  }

  await logAdminAction(
    supabase,
    adminId,
    "create_user_requested",
    "users",
    {
      target_email: email,
      role,
      user_agent: userAgent,
    },
    ipAddress,
  );

  try {
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

    const newUser = created.user;
    if (createError || !newUser) {
      logger.warn("Auth user creation failed", {
        code: createError?.code,
        message: createError?.message,
      });
      return jsonResponse(
        {
          error: "auth_user_creation_failed",
          details: createError?.message ?? "The Auth user was not created.",
        },
        400,
      );
    }

    const compensate = async () => {
      const { error } = await supabase.auth.admin.deleteUser(newUser.id);
      if (error) {
        logger.error("Auth-user compensation failed", {
          userId: newUser.id,
          message: error.message,
        });
      }
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: newUser.id,
          first_name: firstName,
          last_name: lastName,
          username: safeUsername(email, newUser.id),
          email,
        },
        { onConflict: "id" },
      );

    if (profileError) {
      await compensate();
      logger.error("Profile creation failed", {
        userId: newUser.id,
        message: profileError.message,
      });
      return jsonResponse(
        {
          error: "profile_creation_failed",
          details: "The user profile could not be created.",
        },
        400,
      );
    }

    const { error: clearRolesError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", newUser.id);

    if (clearRolesError) {
      await compensate();
      logger.error("Default role cleanup failed", {
        userId: newUser.id,
        message: clearRolesError.message,
      });
      return jsonResponse(
        {
          error: "role_assignment_failed",
          details: "The user's role could not be prepared.",
        },
        400,
      );
    }

    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: newUser.id,
        role,
        assigned_by: adminId,
        is_super_admin: false,
      });

    if (roleError) {
      await compensate();
      logger.error("Role assignment failed", {
        userId: newUser.id,
        message: roleError.message,
      });
      return jsonResponse(
        {
          error: "role_assignment_failed",
          details: "The requested role could not be assigned.",
        },
        400,
      );
    }

    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: "user_created",
      details: {
        new_user_id: newUser.id,
        target_email: email,
        role,
        created_by_admin: true,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return jsonResponse(
      {
        success: true,
        message: "User created successfully",
        user: {
          id: newUser.id,
          email,
          role,
        },
      },
      200,
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown create-user error";
    logger.error("Critical create-user error", { message });
    return jsonResponse(
      {
        error: "user_creation_failed",
        details: "The user could not be created.",
      },
      500,
    );
  }
}
