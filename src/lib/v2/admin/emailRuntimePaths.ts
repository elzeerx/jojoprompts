// Source-of-truth registry for Admin V2 Communications operational surfaces.
//
// This module is the single place that maps a customer-facing email surface
// (order receipt, welcome, auth confirmation, password reset) to its ACTUAL
// runtime implementation in this repository. The admin Communications /
// Templates screen consumes this registry so operational cards can never
// drift from what the code actually does.
//
// Rules:
//   * NEVER hard-code a function name that does not exist as a real active
//     runtime path (deployed function directory in supabase/functions/, an
//     application-code invocation, or a Supabase Auth built-in).
//   * If a surface has no verifiable active path in source, mark it as
//     `status: "not_configured"` and give a reason. Do not invent one.
//   * "Legacy" DB-driven templates in public.email_templates are archive-only
//     and MUST NOT be listed here; they are surfaced separately.
//
// Contract tested by emailRuntimePaths.test.ts.

export type EmailRuntimeStatus = "active" | "not_configured";

export type EmailRuntimeSource =
  | "V2 delivery (edge functions)"
  | "Application code"
  | "Supabase Auth"
  | "Not configured";

export interface EmailRuntimePath {
  /** Stable machine key. Do not rename without updating tests + admin UI. */
  key: string;
  /** Short human name shown in the admin card. */
  name: string;
  /** Localised Arabic name. Kept alongside EN in the same row. */
  nameAr: string;
  /** Concise operational description in admin voice. */
  purpose: string;
  /** Arabic companion sentence for the description column. */
  purposeAr: string;
  /** Where this surface is actually implemented. */
  source: EmailRuntimeSource;
  /** Current operational status. */
  status: EmailRuntimeStatus;
  /**
   * Zero or more concrete active runtime path identifiers. Examples:
   *   - "v2-upayments-webhook" (edge function directory)
   *   - "_shared/v2ReceiptDelivery.ts" (shared module)
   *   - "auth.resetPasswordForEmail" (Supabase Auth built-in)
   * Empty when status is "not_configured".
   */
  runtimePaths: readonly string[];
  /** Human explanation when status is "not_configured". Empty otherwise. */
  notConfiguredReason?: string;
}

/**
 * Authoritative registry. Ordering is the display order in the admin table.
 *
 * Order-receipt: real active path is the V2 UPayments webhook + status
 * poller which, after a successful settlement RPC, invoke the shared
 * `_shared/v2ReceiptDelivery.ts` module (`scheduleReceiptDelivery`) to render
 * the bilingual receipt and send it via Resend. There is NO `send-order-
 * receipt` function in this repository — that name was a documentation
 * artefact and has been removed.
 *
 * Welcome: no `send-welcome` function exists in this repository's source
 * (there is no `supabase/functions/send-welcome/` directory). We therefore
 * report Welcome as `not_configured` from the point of view of this admin
 * screen. If a real active runtime path is later added, list it here and
 * flip status to "active" — do not add it speculatively.
 *
 * Auth email confirmation + password reset are delivered by Supabase Auth
 * itself (`signUp` / `resetPasswordForEmail`), not by any function in this
 * repository. They are always "active" as long as Supabase Auth is enabled.
 */
export const EMAIL_RUNTIME_PATHS: readonly EmailRuntimePath[] = Object.freeze([
  {
    key: "v2-order-receipt",
    name: "Order receipt",
    nameAr: "إيصال الطلب",
    purpose:
      "Sent after a paid V2 order settles. Rendered and dispatched by the shared V2 receipt delivery module, invoked from the UPayments webhook and status poller — never from a `send-order-receipt` function.",
    purposeAr:
      "يُرسل بعد تسوية الطلب المدفوع. يتم تركيبه وإرساله عبر وحدة إيصالات V2 المشتركة التي يتم استدعاؤها من ويب هوك وحالة UPayments.",
    source: "V2 delivery (edge functions)",
    status: "active",
    runtimePaths: [
      "supabase/functions/v2-upayments-webhook/index.ts",
      "supabase/functions/v2-upayments-status/index.ts",
      "supabase/functions/_shared/v2ReceiptDelivery.ts",
    ],
  },
  {
    key: "welcome",
    name: "Welcome",
    nameAr: "ترحيب",
    purpose:
      "No `send-welcome` function exists in this repository's source. No V2 welcome delivery path is source-tracked here.",
    purposeAr:
      "لا توجد دالة `send-welcome` في مصدر هذا المستودع. لا يوجد مسار إرسال ترحيب V2 مسجّل هنا.",
    source: "Not configured",
    status: "not_configured",
    runtimePaths: [],
    notConfiguredReason:
      "No `supabase/functions/send-welcome/` directory in this repository. Add a real active runtime path before restoring this card as `active`.",
  },
  {
    key: "auth-email-confirmation",
    name: "Email confirmation",
    nameAr: "تأكيد البريد",
    purpose:
      "Account confirmation is Supabase Auth-managed and delivered by Supabase Auth on sign-up and email change, not by any function in this repository.",
    purposeAr:
      "تأكيد الحساب يُدار عبر Supabase Auth ويُرسل تلقائياً عند التسجيل أو تغيير البريد، وليس عبر أي دالة في هذا المستودع.",
    source: "Supabase Auth",
    status: "active",
    runtimePaths: ["auth.signUp (Supabase Auth built-in)"],
  },
  {
    key: "auth-password-reset",
    name: "Password reset",
    nameAr: "إعادة تعيين كلمة المرور",
    purpose:
      "Delivered by Supabase Auth via `auth.resetPasswordForEmail()`. No custom function in this repository sends the reset link.",
    purposeAr:
      "يُرسل عبر Supabase Auth باستخدام `auth.resetPasswordForEmail()`. لا توجد دالة مخصصة في هذا المستودع تُرسل رابط الإعادة.",
    source: "Supabase Auth",
    status: "active",
    runtimePaths: ["auth.resetPasswordForEmail (Supabase Auth built-in)"],
  },
]);

/** Lookup helper used by admin cards and tests. */
export function getEmailRuntimePath(key: string): EmailRuntimePath | undefined {
  return EMAIL_RUNTIME_PATHS.find((p) => p.key === key);
}

/**
 * Guard used by contract tests: proves that no entry references a runtime
 * path string that we know is retired / never existed. Extend this list when
 * a false claim is discovered so the regression test fails before shipping.
 */
export const FORBIDDEN_RUNTIME_PATH_TOKENS: readonly string[] = Object.freeze([
  "send-order-receipt",
  "supabase/functions/send-order-receipt",
  "supabase/functions/send-welcome",
]);
