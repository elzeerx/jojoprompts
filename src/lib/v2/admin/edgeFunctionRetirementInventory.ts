/**
 * Edge Function Retirement Inventory — Source-of-truth audit snapshot.
 *
 * Audit date: 2026-07-29 (live retirement verification refresh)
 * Live Supabase project: fxkqgjakbyrxkmevkglv
 * Live inventory: 68 ACTIVE functions.
 *
 * This module is READ-ONLY documentation. It reflects the current live
 * `verify_jwt` flags and the auditor's classification of each function's
 * active source callers, resolved via full component -> parent -> route
 * chain analysis (not just grep).
 *
 * Retirement application semantics:
 *   - `recommendedRetirementAppliedLive` is true only for the 24
 *     route-graph retirement recommendations whose deployed source was
 *     fetched from Supabase on 2026-07-29 and verified as the matching
 *     minimal HTTP 410 stub.
 *   - `magic-login` is a 25th, source-only retirement prepared after the
 *     live refresh. It remains false until the stub is deployed and fetched
 *     back from Supabase.
 *   - `already410Live` is true for every currently verified live 410
 *     function: the 10 pre-existing stubs plus those 24 retirements.
 *   - Required/hardened functions remain false for both flags.
 *
 * Companion documents:
 *   - docs/security/EDGE_FUNCTION_AUDIT_2026-07-28.md (narrative + evidence)
 *   - src/lib/v2/legacyEndpoints.ts (previously-retired V1 payment slugs)
 */

export type Classification =
  | "required_v2"
  | "required_shared_account_auth"
  | "legacy_unreachable"
  | "already_410"
  | "unknown_review";

export type Disposition =
  | "keep"
  | "harden"
  | "retire_to_410"
  | "investigate";

export type AuthMechanism =
  | "platform_jwt"
  | "custom_user_jwt"
  | "verifyAdmin_shared"
  | "service_secret"
  | "provider_signature"
  | "provider_status_reconciliation"
  | "published_resource_allowlist"
  | "captcha_or_rate_limit"
  | "none"
  | "unknown";

export interface EdgeFunctionAuditEntry {
  /** Live Supabase function slug. */
  name: string;
  /** Live verify_jwt flag as reported by Supabase inventory. */
  verifyJwt: boolean;
  /** Current source-side auth mechanism. */
  authMechanism: AuthMechanism;
  /** Proven inbound callers or references (file paths). */
  callers: readonly string[];
  /** Outbound function-to-function or notable external dependencies. */
  outbound: readonly string[];
  /** One-line business purpose. */
  purpose: string;
  /** Matching V2 replacement slug, if any. */
  v2Replacement: string | null;
  /** Audit classification. */
  classification: Classification;
  /** Recommended disposition. */
  disposition: Disposition;
  /**
   * Whether this audit's retirement recommendation is deployed as a
   * verified 410 stub on the live Supabase project.
   */
  recommendedRetirementAppliedLive: boolean;
  /**
   * Whether the live function currently returns the audited HTTP 410
   * stub contract, whether pre-existing or newly retired.
   */
  already410Live: boolean;
  /** Short rationale citing evidence. */
  evidence: string;
}

export const EDGE_FUNCTION_AUDIT_DATE = "2026-07-29" as const;

/** Slugs that were already HTTP 410 before the 24-function retirement pass. */
export const PREEXISTING_410_SLUGS = [
  "check-email-exists",
  "paypal-webhook",
  "resend-confirmation-email",
  "send-email-confirmation-reminder",
  "send-password-reset",
  "send-signup-confirmation",
  "track-email-engagement",
  "validate-signup",
  "verify-password-reset",
  "v2-qa-one-time-package-upload",
] as const;

/**
 * Bounded live retirement set for THIS audit. Exactly 24 slugs
 * (11 obsolete payment/debug + 12 route-graph-resolved + admin-package-upload,
 * which was migrated to `v2-admin-upload-resource-file` in a prior pass and
 * now has zero active callers).
 *
 * Application state (verified live on 2026-07-29):
 *   - ALL 24 slugs have been replaced in-repo with a minimal HTTP 410
 *     retirement stub and the deployed source for every slug was fetched
 *     from Supabase and verified against that contract.
 *   - Zero blockers remain. The 7 slugs previously listed as
 *     blockers (create-subscription, cancel-subscription,
 *     validate-file-upload, get-admin-transactions,
 *     get-users-without-plans, send-plan-reminder,
 *     send-bulk-plan-reminders) were proven unreachable from the
 *     Admin V2 / public route roots via full route-graph analysis
 *     (see docs/security/EDGE_FUNCTION_AUDIT_2026-07-28.md, "Route
 *     reachability proof — 7 retirement blockers"). Their dead
 *     caller modules were neutralized in-place before stubbing.
 *
 * The production website remains launch-locked; this records the current
 * function state and does not authorize any further deployment.
 */
export const LIVE_RETIREMENT_SLUGS = [
  // 11 obsolete-payment / debug retirements
  "debug-environment",
  "get-paypal-client-id",
  "process-paypal-payment",
  "verify-paypal-payment",
  "auto-capture-paypal",
  "recover-orphaned-payments",
  "get-transaction-by-order",
  "send-purchase-confirmation",
  "scheduled-payment-cleanup",
  "process-upayments-payment",
  "upayments-webhook",
  // 12 resolved after route-graph trace (parent chain unreachable
  // from any active adminSectionElements route)
  "create-subscription",
  "cancel-subscription",
  "validate-file-upload",
  "get-admin-transactions",
  "resend-confirmation-alternative",
  "get-users-without-plans",
  "send-bulk-plan-reminders",
  "send-plan-reminder",
  "generate-magic-link",
  "get-user-insights",
  "auto-generate-prompt",
  "admin-users-v2",
  // Migrated away from in a prior pass; PackageUploader now targets
  // v2-admin-upload-resource-file exclusively.
  "admin-package-upload",
] as const;

/**
 * Source-prepared retirements that are not yet deployed. The custom
 * `magic-login` exchange duplicated Supabase Auth's built-in OTP/magic-link
 * flow and depended on a service-role token table. V2 routes old links to the
 * normal login page and uses `supabase.auth.signInWithOtp`.
 */
export const PENDING_RETIREMENT_SLUGS = ["magic-login"] as const;

/** Complete current recommendation: 24 verified live + 1 source-only. */
export const RETIREMENT_SLUGS = [
  ...LIVE_RETIREMENT_SLUGS,
  ...PENDING_RETIREMENT_SLUGS,
] as const;

/** Every function verified live as the minimal HTTP 410 contract. */
export const ALREADY_410_SLUGS = [
  ...PREEXISTING_410_SLUGS,
  ...LIVE_RETIREMENT_SLUGS,
] as const;

/**
 * 410 stubs written by the retirement passes (combined
 * across 2026-07-28 phases). Each corresponding
 * `supabase/functions/<slug>/index.ts` is a minimal reversible retirement
 * stub with no imports, env reads, body parsing, external I/O, database
 * calls, secrets, or logging. The first 24 were verified live on
 * 2026-07-29; `magic-login` remains source-only until the controlled
 * deployment pass.
 */
export const RETIRED_STUB_SLUGS = [
  "debug-environment",
  "get-paypal-client-id",
  "process-paypal-payment",
  "verify-paypal-payment",
  "auto-capture-paypal",
  "recover-orphaned-payments",
  "get-transaction-by-order",
  "send-purchase-confirmation",
  "scheduled-payment-cleanup",
  "process-upayments-payment",
  "upayments-webhook",
  "resend-confirmation-alternative",
  "generate-magic-link",
  "get-user-insights",
  "auto-generate-prompt",
  "admin-users-v2",
  "admin-package-upload",
  // Added in the route-graph-refinement pass (2026-07-28) after
  // proving the 7 caller modules are unreachable from active route
  // roots and neutralizing their dead invoke calls in-place.
  "create-subscription",
  "cancel-subscription",
  "validate-file-upload",
  "get-admin-transactions",
  "get-users-without-plans",
  "send-plan-reminder",
  "send-bulk-plan-reminders",
  // Prepared after the live refresh. V2 uses Supabase Auth directly.
  "magic-login",
] as const;

/**
 * Slugs in `RETIREMENT_SLUGS` NOT yet stubbed. After the 2026-07-28
 * route-graph-refinement pass this list is empty — every retirement
 * recommendation is backed by a source stub. Live state is tracked
 * separately by `recommendedRetirementAppliedLive`.
 */
export const RETIREMENT_BLOCKERS = [] as const;


/**
 * Unambiguous slug -> replacement mappings surfaced in the stub JSON body.
 * Only these six carry a `replacement` field.
 */
export const STUB_REPLACEMENTS: Readonly<Record<string, string>> = {
  "process-upayments-payment": "v2-upayments-checkout",
  "upayments-webhook": "v2-upayments-webhook",
  "validate-file-upload": "v2-admin-upload-resource-file",
  "auto-generate-prompt": "ai-studio-chat",
  "resend-confirmation-alternative": "supabase.auth",
  "magic-login": "supabase.auth",
};


const R = (name: string): Pick<EdgeFunctionAuditEntry,
  "classification" | "disposition" | "recommendedRetirementAppliedLive" | "already410Live"> => ({
  classification: "legacy_unreachable" as const,
  disposition: "retire_to_410" as const,
  recommendedRetirementAppliedLive: true,
  already410Live: true,
});

const P = (name: string): Pick<EdgeFunctionAuditEntry,
  "classification" | "disposition" | "recommendedRetirementAppliedLive" | "already410Live"> => ({
  classification: "legacy_unreachable" as const,
  disposition: "retire_to_410" as const,
  recommendedRetirementAppliedLive: false,
  already410Live: false,
});

export const EDGE_FUNCTION_AUDIT: readonly EdgeFunctionAuditEntry[] = [
  {
    name: "generate-metadata",
    verifyJwt: true,
    authMechanism: "platform_jwt",
    callers: [
      "src/pages/admin/components/prompts/components/AutoGenerateButton.tsx",
      "src/components/prompt-generator/TagsManager.tsx",
      "src/components/prompt-generator/SmartSuggestions.tsx",
    ],
    outbound: ["openai"],
    purpose: "AI: extract prompt metadata (tags, suggestions).",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Active callers; verify_jwt=true covers auth.",
  },
  {
    name: "suggest-prompt",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: [],
    outbound: ["openai"],
    purpose: "AI: suggest new prompts.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "Compatibility admin helper has no current route caller. Source rejects non-POST requests, validates the bearer with auth.getUser, and requires can_manage_prompts before OpenAI or database work.",
  },
  {
    name: "get-all-users",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: [
      "src/pages/admin/components/users/hooks/useUserService.ts",
      "src/pages/admin/components/users/hooks/useUserBulkActions.ts",
      "src/pages/admin/components/users/components/ChangePasswordDialog.tsx",
    ],
    outbound: ["auth.admin"],
    purpose: "Admin user listing.",
    v2Replacement: null,
    classification: "required_shared_account_auth",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "Reached from adminSectionElements.users (UsersV2) via useUserService chain.",
  },
  {
    name: "get-image",
    verifyJwt: false,
    authMechanism: "published_resource_allowlist",
    callers: ["src/components/ui/prompt-card/ImageWrapper.tsx"],
    outbound: ["storage"],
    purpose: "Image proxy (published, non-archived resources only, image MIME).",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "Intentionally public; live handler restricts to published_resource_allowlist paths and image content-types.",
  },
  {
    name: "create-subscription",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/hooks/payment/helpers/subscriptionActivator.ts"],
    outbound: [],
    purpose: "V1 subscription creation.",
    v2Replacement: null,
    ...R("create-subscription"),
    evidence:
      "subscriptionActivator has zero importers in src/; V2 has no subscriptions. Unreachable.",
  },
  {
    name: "cancel-subscription",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/pages/admin/components/users/hooks/useUserService.ts:406"],
    outbound: [],
    purpose: "V1 subscription cancellation.",
    v2Replacement: null,
    ...R("cancel-subscription"),
    evidence:
      "Only cancelUserSubscription (useUserService) callers are UserTableRow + UsersManagement (V1). adminSectionElements.users wires UsersV2, not UsersManagement; UsersV2 does not use cancelUserSubscription. Unreachable.",
  },
  {
    name: "validate-file-upload",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/hooks/useSecureFileUpload.ts"],
    outbound: [],
    purpose: "V1 upload validator.",
    v2Replacement: "v2-admin-upload-resource-file",
    ...R("validate-file-upload"),
    evidence:
      "Only importer is src/pages/admin/components/prompts/components/SecureImageUploadField.tsx (V1 prompts admin). No adminSectionElements route wires that component (publishing uses ResourcePublisher, not V1 prompts). Unreachable.",
  },
  {
    name: "get-paypal-client-id",
    verifyJwt: false,
    authMechanism: "none",
    callers: [],
    outbound: ["paypal"],
    purpose: "V1 PayPal client-id exposure.",
    v2Replacement: null,
    ...R("get-paypal-client-id"),
    evidence: "No active src caller; PayPal retired in V2.",
  },
  {
    name: "process-paypal-payment",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/lib/v2/legacyEndpoints.ts"],
    outbound: ["paypal"],
    purpose: "V1 PayPal capture.",
    v2Replacement: "v2-upayments-checkout",
    ...R("process-paypal-payment"),
    evidence: "Registry-only reference; PayPal retired in V2.",
  },
  {
    name: "verify-paypal-payment",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/lib/v2/legacyEndpoints.ts"],
    outbound: ["paypal"],
    purpose: "V1 PayPal verify.",
    v2Replacement: "v2-upayments-status",
    ...R("verify-paypal-payment"),
    evidence: "Registry-only reference.",
  },
  {
    name: "recover-orphaned-payments",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/lib/v2/legacyEndpoints.ts"],
    outbound: ["user_subscriptions (service_role)"],
    purpose: "V1 payment cleanup (public, caller-supplied userId).",
    v2Replacement: null,
    ...R("recover-orphaned-payments"),
    evidence:
      "Registry-only ref in src. CRITICAL: live logs (24h) show repeated calls; current handler is unauthenticated, accepts caller-supplied userId, and uses service_role on user_subscriptions. Confirmed exposure; top-priority retirement even if calls are QA-origin.",
  },
  {
    name: "paypal-webhook",
    verifyJwt: false,
    authMechanism: "none",
    callers: [],
    outbound: [],
    purpose: "V1 PayPal webhook.",
    v2Replacement: null,
    classification: "already_410",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: true,
    evidence: "Live returns 410; source stub present.",
  },
  {
    name: "get-transaction-by-order",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: [
      "src/pages/admin/components/purchases/hooks/usePurchaseHistory.ts:70",
    ],
    outbound: [],
    purpose: "V1 admin order lookup.",
    v2Replacement: null,
    ...R("get-transaction-by-order"),
    evidence:
      "Only importer is PurchaseHistoryManagement, which is NOT registered in adminSectionElements. V2 orders surface is OrdersV2Page/PaymentEventsPage. Unreachable. (Live handler calls shared verifyAdmin(req) before any body processing; that guard is not the retirement rationale — reachability is.)",
  },
  {
    name: "delete-my-account",
    verifyJwt: false,
    authMechanism: "custom_user_jwt",
    callers: ["src/components/account/DeleteAccountDialog.tsx"],
    outbound: ["auth.admin"],
    purpose: "Self-service account deletion.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "Dormant self-service helper. Source validates the bearer with auth.getUser, binds delete_user_account to user.id, and requires an exact confirmation-email match. Not currently surfaced by the V2 account page.",
  },
  {
    name: "send-email",
    verifyJwt: false,
    authMechanism: "service_secret",
    callers: [
      "src/utils/emailService.ts",
      "src/lib/v2/admin/emailSettings.ts",
    ],
    outbound: ["resend"],
    purpose: "Transactional email sender.",
    v2Replacement: null,
    classification: "required_shared_account_auth",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Two active callers; HMAC/service-secret gated.",
  },
  {
    name: "get-admin-transactions",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: [
      "src/pages/admin/components/purchases/hooks/usePurchaseHistory.ts:70",
    ],
    outbound: [],
    purpose: "V1 admin transaction listing.",
    v2Replacement: null,
    ...R("get-admin-transactions"),
    evidence:
      "usePurchaseHistory only imported by PurchaseHistoryManagement, which is NOT wired into adminSectionElements. Live handler guards with shared verifyAdmin(req) prior to response, but no reachable UI. Unreachable.",
  },
  {
    name: "generate-use-case",
    verifyJwt: true,
    authMechanism: "platform_jwt",
    callers: ["src/pages/admin/components/prompts/components/UseCaseField.tsx"],
    outbound: ["openai"],
    purpose: "AI: generate use-case text.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Admin prompt tooling.",
  },
  {
    name: "resend-confirmation-email",
    verifyJwt: false,
    authMechanism: "none",
    callers: [],
    outbound: [],
    purpose: "V1 email confirmation resend.",
    v2Replacement: null,
    classification: "already_410",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: true,
    evidence: "Source is 410 stub.",
  },
  {
    name: "auto-capture-paypal",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/lib/v2/legacyEndpoints.ts"],
    outbound: ["paypal"],
    purpose: "V1 PayPal auto-capture.",
    v2Replacement: null,
    ...R("auto-capture-paypal"),
    evidence: "Registry only.",
  },
  {
    name: "scheduled-payment-cleanup",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/lib/v2/legacyEndpoints.ts"],
    outbound: [],
    purpose: "V1 payment cleanup cron.",
    v2Replacement: null,
    ...R("scheduled-payment-cleanup"),
    evidence:
      "No pg_cron entry (only daily-security-cleanup runs). Registry-only src reference.",
  },
  {
    name: "debug-environment",
    verifyJwt: false,
    authMechanism: "none",
    callers: [],
    outbound: [],
    purpose: "Runtime/environment introspection.",
    v2Replacement: null,
    ...R("debug-environment"),
    evidence:
      "Previously exposed unauthenticated environment/config diagnostics. Supabase live version 326 was fetched on 2026-07-29 and verified as the minimal endpoint_retired HTTP 410 stub; future syncs must preserve source-first and post-deploy source/hash verification.",
  },
  {
    name: "resend-confirmation-alternative",
    verifyJwt: true,
    authMechanism: "platform_jwt",
    callers: [],
    outbound: [],
    purpose: "Alternative signup confirmation resender.",
    v2Replacement: "supabase.auth.resend",
    ...R("resend-confirmation-alternative"),
    evidence:
      "Zero references outside supabase/config.toml and this inventory. Supabase Auth owns confirmation flows. Unreachable.",
  },
  {
    name: "send-signup-confirmation",
    verifyJwt: false,
    authMechanism: "none",
    callers: [],
    outbound: [],
    purpose: "V1 signup confirmation.",
    v2Replacement: null,
    classification: "already_410",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: true,
    evidence: "Source is 410 stub.",
  },
  {
    name: "track-email-engagement",
    verifyJwt: false,
    authMechanism: "none",
    callers: [],
    outbound: [],
    purpose: "Email open/click tracking.",
    v2Replacement: null,
    classification: "already_410",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: true,
    evidence: "Source is 410 stub.",
  },
  {
    name: "enhance-prompt",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/components/enhanced-prompt/EnhancedPromptBuilder.tsx"],
    outbound: ["openai"],
    purpose: "AI: prompt enhancement.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "Legacy component caller is outside the active route graph. Source validates the bearer with auth.getUser and requires an admin/prompter/jadmin role before OpenAI work.",
  },
  {
    name: "send-email-confirmation-reminder",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/hooks/usePostPurchaseEmail.ts"],
    outbound: [],
    purpose: "V1 reminder emailer.",
    v2Replacement: null,
    classification: "already_410",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: true,
    evidence: "Source is 410 stub; hook still references slug but receives 410.",
  },
  {
    name: "send-purchase-confirmation",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/lib/v2/legacyEndpoints.ts"],
    outbound: [],
    purpose: "V1 purchase confirmation.",
    v2Replacement: "v2ReceiptDelivery (hardcoded HTML)",
    ...R("send-purchase-confirmation"),
    evidence: "Registry only; V2 uses inline receipts.",
  },
  {
    name: "get-users-without-plans",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/hooks/useUsersWithoutPlans.ts"],
    outbound: [],
    purpose: "Admin marketing: users without active plans.",
    v2Replacement: null,
    ...R("get-users-without-plans"),
    evidence:
      "Hook only used by src/pages/admin/components/users/components/MarketingEmailsPanel.tsx; MarketingEmailsPanel only rendered by MarketingPage.tsx; MarketingPage is NOT registered in adminSectionElements. V2 dropped plan reminders. Unreachable.",
  },
  {
    name: "send-bulk-plan-reminders",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/hooks/useMarketingEmails.ts"],
    outbound: ["send-email", "generate-magic-link", "get-user-insights"],
    purpose: "Admin bulk plan reminders.",
    v2Replacement: null,
    ...R("send-bulk-plan-reminders"),
    evidence:
      "useMarketingEmails only used by MarketingEmailsPanel; MarketingPage unwired. Unreachable.",
  },
  {
    name: "send-plan-reminder",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/hooks/useMarketingEmails.ts"],
    outbound: ["send-email", "generate-magic-link", "get-user-insights"],
    purpose: "Admin single plan reminder.",
    v2Replacement: null,
    ...R("send-plan-reminder"),
    evidence: "Same chain as bulk variant; MarketingPage unwired. Unreachable.",
  },
  {
    name: "generate-magic-link",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: [
      "supabase/functions/send-bulk-plan-reminders/index.ts:178",
      "supabase/functions/send-plan-reminder/index.ts:158",
    ],
    outbound: ["auth.admin"],
    purpose: "Admin magic-link issuance (used by plan reminders).",
    v2Replacement: null,
    ...R("generate-magic-link"),
    evidence:
      "Only invoked internally by send-plan-reminder/send-bulk-plan-reminders, both unreachable. V2 uses Supabase Auth signInWithOtp and the legacy magic-login exchange is separately retired. Unreachable.",
  },
  {
    name: "magic-login",
    verifyJwt: false,
    authMechanism: "none",
    callers: [],
    outbound: [],
    purpose: "Legacy custom magic-token exchange.",
    v2Replacement: "supabase.auth",
    ...P("magic-login"),
    evidence:
      "V2 login and resend flows use supabase.auth.signInWithOtp. The compatibility /auth/magic-login route now redirects safely to /login and never invokes this function. Source is a 410 stub; live deployment remains pending.",
  },
  {
    name: "get-user-insights",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: [
      "supabase/functions/send-plan-reminder/index.ts:137",
      "supabase/functions/send-bulk-plan-reminders/index.ts:160",
    ],
    outbound: [],
    purpose: "Admin user insights (used by plan reminders).",
    v2Replacement: null,
    ...R("get-user-insights"),
    evidence:
      "Only internal callers are plan-reminder functions, both unreachable. No src caller. Unreachable.",
  },
  {
    name: "smart-unsubscribe",
    verifyJwt: false,
    authMechanism: "captcha_or_rate_limit",
    callers: ["src/pages/UnsubscribePage.tsx"],
    outbound: [],
    purpose: "Token-only unsubscribe.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Hardened in prior pass; token-only.",
  },
  {
    name: "ai-gpt5-metaprompt",
    verifyJwt: false,
    authMechanism: "platform_jwt",
    callers: ["src/components/prompt-generator/GPT5MetaPromptTab.tsx"],
    outbound: ["openai"],
    purpose: "AI: GPT-5 metaprompt.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "Legacy component is outside the active route graph. Source rejects non-POST requests, validates the bearer with auth.getUser, and requires an admin/prompter/jadmin role before OpenAI work.",
  },
  {
    name: "ai-json-spec",
    verifyJwt: false,
    authMechanism: "platform_jwt",
    callers: ["src/components/prompt-generator/JsonSpecTab.tsx"],
    outbound: ["openai"],
    purpose: "AI: JSON spec generator.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "Legacy component is outside the active route graph. Source rejects non-POST requests, validates the bearer with auth.getUser, and requires an admin/prompter/jadmin role before OpenAI work.",
  },
  {
    name: "translate-prompt",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/services/PromptService.ts"],
    outbound: ["openai"],
    purpose: "AI: bilingual prompt translation.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Hardened in prior pass.",
  },
  {
    name: "translate-text",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: [
      "src/components/prompt-generator/TranslationButtons.tsx",
      "src/pages/admin/components/prompts/components/BilingualFields.tsx",
    ],
    outbound: ["openai"],
    purpose: "AI: generic translation.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "Legacy callers are outside the active route graph. Source rejects non-POST requests, validates the bearer with auth.getUser, and requires can_manage_prompts before OpenAI work.",
  },
  {
    name: "auto-generate-prompt",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: [],
    outbound: ["openai"],
    purpose: "AI: prompt auto-generation.",
    v2Replacement: "ai-studio-chat",
    ...R("auto-generate-prompt"),
    evidence:
      "No source caller outside test fixtures. V2 prompt generation uses ai-studio-chat/ai-json-spec. Unreachable.",
  },
  {
    name: "validate-signup",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/components/auth/hooks/useSignupForm.ts"],
    outbound: [],
    purpose: "V1 signup validator.",
    v2Replacement: null,
    classification: "already_410",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: true,
    evidence: "Source is 410 stub; hook receives 410.",
  },
  {
    name: "admin-users-v2",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: [],
    outbound: ["auth.admin"],
    purpose: "Purpose-built V2 admin user management (unused).",
    v2Replacement: null,
    ...R("admin-users-v2"),
    evidence:
      "Zero src callers. UsersV2 uses useUserService (get-all-users, admin-bulk-confirm-users, resend-payment-email), not admin-users-v2. Slug name suggests intended V2 replacement but was never wired. Unreachable.",
  },
  {
    name: "resend-payment-email",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/pages/admin/components/users/hooks/useUserActions.ts"],
    outbound: ["send-email"],
    purpose: "Admin resend payment email.",
    v2Replacement: null,
    classification: "required_shared_account_auth",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Reachable from adminSectionElements.users (UsersV2).",
  },
  {
    name: "admin-bulk-confirm-users",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: [
      "src/pages/admin/components/users/hooks/useUserService.ts",
      "src/pages/admin/components/users/hooks/useUserBulkActions.ts",
    ],
    outbound: ["auth.admin"],
    purpose: "Admin bulk email confirmation.",
    v2Replacement: null,
    classification: "required_shared_account_auth",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Reachable from adminSectionElements.users (UsersV2).",
  },
  {
    name: "check-email-exists",
    verifyJwt: false,
    authMechanism: "none",
    callers: [],
    outbound: [],
    purpose: "V1 email enumeration.",
    v2Replacement: null,
    classification: "already_410",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: true,
    evidence: "Source is 410 stub.",
  },
  {
    name: "process-upayments-payment",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/lib/v2/legacyEndpoints.ts"],
    outbound: ["upayments"],
    purpose: "V1 UPayments processor.",
    v2Replacement: "v2-upayments-checkout",
    ...R("process-upayments-payment"),
    evidence: "Registry only.",
  },
  {
    name: "upayments-webhook",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/lib/v2/legacyEndpoints.ts"],
    outbound: [],
    purpose: "V1 UPayments webhook.",
    v2Replacement: "v2-upayments-webhook",
    ...R("upayments-webhook"),
    evidence: "Registry only; provider now targets v2-upayments-webhook.",
  },
  {
    name: "send-abandoned-cart-email",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: [
      "src/hooks/useAbandonedCart.ts",
      "src/pages/admin/components/abandoned-cart/AbandonedCartManagement.tsx",
    ],
    outbound: ["send-email"],
    purpose: "Abandoned cart email.",
    v2Replacement: null,
    classification: "required_shared_account_auth",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Two active callers.",
  },
  {
    name: "send-password-reset",
    verifyJwt: false,
    authMechanism: "none",
    callers: ["src/pages/admin/components/users/hooks/useUserService.ts"],
    outbound: [],
    purpose: "V1 custom password reset.",
    v2Replacement: "supabase.auth.resetPasswordForEmail",
    classification: "already_410",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: true,
    evidence: "Source is 410 stub; admin caller receives 410.",
  },
  {
    name: "verify-password-reset",
    verifyJwt: false,
    authMechanism: "none",
    callers: [],
    outbound: [],
    purpose: "V1 password reset verify.",
    v2Replacement: null,
    classification: "already_410",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: true,
    evidence: "Source is 410 stub.",
  },
  {
    name: "ai-studio-chat",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: [
      "src/pages/admin/sections/ai-studio/AiStudioChat.tsx",
      "src/lib/v2/admin/integrationsSettings.ts",
    ],
    outbound: ["openai"],
    purpose: "Admin AI Studio chat.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Two admin callers.",
  },
  {
    name: "ai-studio-image",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/lib/v2/admin/integrationsSettings.ts"],
    outbound: ["openai"],
    purpose: "Admin AI Studio image.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Admin integrations probe.",
  },
  {
    name: "mcp",
    verifyJwt: false,
    authMechanism: "platform_jwt",
    callers: ["src/lib/v2/admin/integrationsSettings.ts"],
    outbound: [],
    purpose: "Model Context Protocol endpoint.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "Generated @lovable.dev/mcp-js handler declares Supabase OAuth issuer auth with authenticated audience; tools also require ctx.isAuthenticated and query through the caller bearer token.",
  },
  {
    name: "resource-download",
    verifyJwt: false,
    authMechanism: "custom_user_jwt",
    callers: [
      "src/hooks/v2/useResourceDownload.ts",
      "src/lib/v2/admin/storageSettings.ts",
    ],
    outbound: ["storage"],
    purpose: "V2 entitled resource download.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "verify_jwt=false with in-handler user JWT validation (custom_user_jwt); V2 library download flow.",
  },
  {
    name: "admin-package-upload",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: [],
    outbound: ["storage"],
    purpose: "V1 admin package upload (migrated to v2-admin-upload-resource-file).",
    v2Replacement: "v2-admin-upload-resource-file",
    ...R("admin-package-upload"),
    evidence:
      "PackageUploader.tsx now invokes v2-admin-upload-resource-file exclusively (see line 154). Zero remaining src callers of admin-package-upload; safe to retire in source. Live deployment unchanged.",
  },

  {
    name: "v2-upayments-checkout",
    verifyJwt: false,
    authMechanism: "custom_user_jwt",
    callers: ["src/pages/v2/V2CheckoutPage.tsx"],
    outbound: ["upayments"],
    purpose: "V2 UPayments checkout initiation.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "verify_jwt=false with in-handler user JWT validation; V2 checkout entry point. Emits notification URL that provider posts back to v2-upayments-webhook.",
  },
  {
    name: "v2-upayments-refund",
    verifyJwt: false,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/hooks/admin/v2/useAdminCommerce.ts"],
    outbound: ["upayments"],
    purpose: "V2 UPayments refund (admin).",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Admin commerce path.",
  },
  {
    name: "v2-upayments-status",
    verifyJwt: false,
    authMechanism: "custom_user_jwt",
    callers: [
      "src/hooks/admin/v2/useAdminCommerce.ts",
      "src/pages/v2/V2CheckoutReturnPage.tsx",
      "src/pages/v2/V2CheckoutCancelPage.tsx",
    ],
    outbound: ["upayments"],
    purpose: "V2 UPayments status polling.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "verify_jwt=false with in-handler user JWT validation; three active callers.",
  },
  {
    name: "v2-upayments-webhook",
    verifyJwt: false,
    authMechanism: "provider_status_reconciliation",
    callers: [
      "supabase/functions/v2-upayments-checkout (emits notification URL)",
    ],
    outbound: ["upayments"],
    purpose: "V2 UPayments notification receiver.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence:
      "Inbound caller is the UPayments provider hitting the notification URL emitted by v2-upayments-checkout — NOT any UI component. Handler validates envelope, resolves local attempt, then performs a server-to-server status reconciliation with UPayments before settlement. No cryptographic provider signature is verified in current source.",
  },
  {
    name: "submit-contact",
    verifyJwt: false,
    authMechanism: "captcha_or_rate_limit",
    callers: ["src/pages/ContactPage.tsx"],
    outbound: ["send-email"],
    purpose: "Public contact form submission.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Public form; verify_jwt=false intentional.",
  },
  {
    name: "v2-admin-upload-resource-file",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: [
      "src/lib/v2/admin/storageSettings.ts",
      "src/pages/admin/sections/publishing/UploadPackageFile.tsx",
    ],
    outbound: ["storage"],
    purpose: "V2 admin resource upload (leasing + SHA-256).",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "V2 replacement for admin-package-upload.",
  },
  {
    name: "v2-admin-package-scan-control",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: [
      "src/lib/v2/admin/storageSettings.ts",
      "src/hooks/admin/v2/useScanProvider.ts",
    ],
    outbound: ["v2-package-scan-worker"],
    purpose: "V2 admin package scan control.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Admin scan controls.",
  },
  {
    name: "v2-package-scan-worker",
    verifyJwt: false,
    authMechanism: "service_secret",
    callers: ["src/lib/v2/admin/storageSettings.ts"],
    outbound: ["cloudmersive"],
    purpose: "V2 synchronous virus scan worker (Cloudmersive).",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Triggered internally by scan control.",
  },
  {
    name: "v2-qa-one-time-package-upload",
    verifyJwt: false,
    authMechanism: "none",
    callers: [],
    outbound: [],
    purpose: "QA one-shot upload harness.",
    v2Replacement: null,
    classification: "already_410",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: true,
    evidence:
      "Live returns 410; no source directory in this repo.",
  },
  {
    name: "v2-admin-payment-settings-status",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/hooks/admin/v2/useAdminPaymentSettings.ts"],
    outbound: [],
    purpose: "V2 admin payment settings dashboard.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Admin V2 dashboard.",
  },
  {
    name: "v2-admin-email-settings-status",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/hooks/admin/v2/useAdminEmailSettings.ts"],
    outbound: [],
    purpose: "V2 admin email settings dashboard.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Admin V2 dashboard.",
  },
  {
    name: "v2-admin-storage-settings-status",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/hooks/admin/v2/useAdminStorageSettings.ts"],
    outbound: [],
    purpose: "V2 admin storage settings dashboard.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Admin V2 dashboard.",
  },
  {
    name: "v2-admin-integrations-settings-status",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/hooks/admin/v2/useAdminIntegrationsSettings.ts"],
    outbound: [],
    purpose: "V2 admin integrations settings dashboard.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Admin V2 dashboard.",
  },
  {
    name: "v2-admin-roles-settings-status",
    verifyJwt: true,
    authMechanism: "verifyAdmin_shared",
    callers: ["src/hooks/admin/v2/useAdminRolesSettingsStatus.ts"],
    outbound: [],
    purpose: "V2 admin roles/permissions dashboard.",
    v2Replacement: null,
    classification: "required_v2",
    disposition: "keep",
    recommendedRetirementAppliedLive: false,
    already410Live: false,
    evidence: "Admin V2 dashboard.",
  },
] as const;

/** Bounded retirement set (retire_to_410, verified live on 2026-07-29). */
export const RECOMMENDED_RETIREMENTS: readonly string[] = EDGE_FUNCTION_AUDIT
  .filter((e) => e.disposition === "retire_to_410")
  .map((e) => e.name);

/** Functions flagged for hardening (not retirement). */
export const RECOMMENDED_HARDENING: readonly string[] = EDGE_FUNCTION_AUDIT
  .filter((e) => e.disposition === "harden")
  .map((e) => e.name);

/** Functions requiring further investigation. Zero after this route-graph pass. */
export const REQUIRES_INVESTIGATION: readonly string[] = EDGE_FUNCTION_AUDIT
  .filter((e) => e.disposition === "investigate")
  .map((e) => e.name);
