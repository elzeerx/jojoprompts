import {
  createErrorResponse,
  createSuccessResponse,
  handleCors,
  serve,
} from "../_shared/standardImports.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";
import { createEdgeLogger } from "../_shared/logger.ts";
import { logAdminAction } from "../shared/securityLogger.ts";

const logger = createEdgeLogger("ADMIN_BULK_CONFIRM_USERS");
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_USERS_PER_REQUEST = 100;

interface ConfirmUsersRequest {
  userIds?: unknown;
  dryRun?: unknown;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors();
  }

  try {
    if (req.method !== "POST") {
      return createErrorResponse("Method not allowed", 405);
    }

    const {
      supabase,
      userId: adminUserId,
      userRole,
    } = await verifyAdmin(req);

    if (userRole !== "admin") {
      return createErrorResponse(
        "Super admin required to confirm user email addresses",
        403,
      );
    }

    const { data: actorRole, error: actorRoleError } = await supabase
      .from("user_roles")
      .select("is_super_admin")
      .eq("user_id", adminUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (actorRoleError || actorRole?.is_super_admin !== true) {
      logger.warn("Unauthorized email-confirmation attempt", {
        adminUserId,
        roleLookupError: actorRoleError?.message,
      });
      return createErrorResponse(
        "Super admin required to confirm user email addresses",
        403,
      );
    }

    const parsed = await req.json() as ConfirmUsersRequest;
    const requestedIds = Array.isArray(parsed.userIds)
      ? parsed.userIds
      : [];
    const targetUserIds = [
      ...new Set(
        requestedIds.filter(
          (value): value is string =>
            typeof value === "string" && UUID_PATTERN.test(value),
        ),
      ),
    ];

    if (
      targetUserIds.length === 0 ||
      targetUserIds.length !== requestedIds.length
    ) {
      return createErrorResponse(
        "Provide one or more valid user IDs",
        400,
      );
    }

    if (targetUserIds.length > MAX_USERS_PER_REQUEST) {
      return createErrorResponse(
        `A maximum of ${MAX_USERS_PER_REQUEST} users can be confirmed at once`,
        400,
      );
    }

    const dryRun = parsed.dryRun === true;
    if (dryRun) {
      return createSuccessResponse({
        dryRun: true,
        totalUsers: targetUserIds.length,
        processed: 0,
        confirmed: 0,
        failed: 0,
      });
    }

    const results = {
      dryRun: false,
      totalUsers: targetUserIds.length,
      processed: 0,
      confirmed: 0,
      failed: 0,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    const batchSize = 10;
    for (let index = 0; index < targetUserIds.length; index += batchSize) {
      const batch = targetUserIds.slice(index, index + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (targetUserId) => {
          const { error } = await supabase.auth.admin.updateUserById(
            targetUserId,
            { email_confirm: true },
          );

          return { targetUserId, error };
        }),
      );

      for (const result of batchResults) {
        results.processed += 1;
        if (result.error) {
          results.failed += 1;
          results.errors.push({
            userId: result.targetUserId,
            error: result.error.message,
          });
        } else {
          results.confirmed += 1;
        }
      }
    }

    await logAdminAction(
      supabase,
      adminUserId,
      "admin_confirm_user_emails",
      "auth.users",
      {
        target_user_ids: targetUserIds,
        processed: results.processed,
        confirmed: results.confirmed,
        failed: results.failed,
      },
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    );

    logger.info("Email confirmation request completed", {
      adminUserId,
      processed: results.processed,
      confirmed: results.confirmed,
      failed: results.failed,
    });

    return createSuccessResponse(results);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    logger.error("Function error", { error: message });

    const status = message.includes("authorization") ||
        message.includes("token")
      ? 401
      : message.includes("privilege") ||
          message.includes("Admin access required")
      ? 403
      : 500;

    return createErrorResponse(message, status);
  }
});
