import { Suspense, lazy } from "react";
import { AdminSectionSkeleton } from "./AdminSectionSkeleton";
import { EmptyRouteState } from "../sections/common/EmptyRouteState";

// Real V2 sections
const OverviewV2 = lazy(() => import("../sections/overview/OverviewV2"));
const CatalogPage = lazy(() => import("../sections/catalog/CatalogPage"));
const ResourcePublisher = lazy(() => import("../sections/publishing/ResourcePublisher"));


// Existing legacy sections retained where they map cleanly onto V2 routes.
const JsonPromptImporter = lazy(() => import("../sections/content/JsonPromptImporter"));
const AuditLogPage = lazy(() => import("../sections/system/AuditLogPage"));
const AiStudioPage = lazy(() => import("../sections/ai-studio/AiStudioPage"));
const CategoriesManagement = lazy(() =>
  import("../components/categories/CategoriesManagement").then((m) => ({
    default: m.CategoriesManagement,
  }))
);
const UsersManagement = lazy(() => import("../components/users/UsersManagement"));
const PurchaseHistoryManagement = lazy(
  () => import("../components/purchases/PurchaseHistoryManagement")
);
const DiscountCodesManagement = lazy(
  () => import("../components/discount-codes/DiscountCodesManagement")
);
const AbandonedCartDashboard = lazy(() =>
  import("../components/abandoned-cart/AbandonedCartDashboard").then((m) => ({
    default: m.AbandonedCartDashboard,
  }))
);
const EmailTemplatesManagement = lazy(() =>
  import("@/components/admin/EmailTemplatesManagement").then((m) => ({
    default: m.EmailTemplatesManagement,
  }))
);
const EmailAnalyticsDashboard = lazy(() =>
  import("@/components/admin/EmailAnalyticsDashboard").then((m) => ({
    default: m.EmailAnalyticsDashboard,
  }))
);
const SecurityMonitoringDashboard = lazy(() =>
  import("@/components/admin/SecurityMonitoringDashboard").then((m) => ({
    default: m.SecurityMonitoringDashboard,
  }))
);

const wrap = (node: React.ReactNode) => (
  <Suspense fallback={<AdminSectionSkeleton />}>{node}</Suspense>
);

const Empty = (
  title: string,
  description: string,
  legacy?: { label: string; to: string }[],
) => wrap(<EmptyRouteState title={title} description={description} legacy={legacy} />);

// Locked-type catalog wrappers to preserve deterministic query keys.
const AllCatalog = () => <CatalogPage />;
const SkillsCatalog = () => <CatalogPage lockedType="skill" />;
const AutomationsCatalog = () => <CatalogPage lockedType="automation" />;
const PromptsCatalog = () => <CatalogPage includeTypes={["prompt", "prompt_pack"]} title="Prompts & Prompt Packs" />;
const PromptPacksCatalog = () => <CatalogPage lockedType="prompt_pack" />;
const ImageStylesCatalog = () => <CatalogPage lockedType="image_style" />;
const BundlesCatalog = () => <CatalogPage lockedType="bundle" />;

export const adminSectionElements = {
  // Overview
  overview: wrap(<OverviewV2 />),

  // Catalog
  catalog: wrap(<AllCatalog />),
  catalogSkills: wrap(<SkillsCatalog />),
  catalogAutomations: wrap(<AutomationsCatalog />),
  catalogPrompts: wrap(<PromptsCatalog />),
  catalogPromptPacks: wrap(<PromptPacksCatalog />),
  catalogImageStyles: wrap(<ImageStylesCatalog />),
  catalogBundles: wrap(<BundlesCatalog />),

  // Publishing — unified publisher
  publishingNew: wrap(<ResourcePublisher mode="new" />),
  publishingEdit: wrap(<ResourcePublisher mode="edit" />),
  publishingNewVersion: wrap(<ResourcePublisher mode="new-version" />),


  // Publishing
  publishingDrafts: Empty(
    "Drafts",
    "Draft resources live in the unified Catalog table for now. Filter by status = Draft to see them; a dedicated Drafts board with reviewer assignment lands in Phase 2.",
    [{ label: "Open Catalog (Draft filter)", to: "/admin/catalog?status=draft" }],
  ),
  publishingReview: Empty(
    "Review Queue",
    "Resources submitted for review will surface here with approve / request-changes actions. Until wired, use the Catalog table with status = In review.",
    [{ label: "Open Catalog (Review filter)", to: "/admin/catalog?status=review" }],
  ),
  publishingVersions: Empty(
    "Versions",
    "Per-resource version history and package promotion is being wired against resource_versions and package_scans. Individual versions are visible from a resource's row action ‘New version’.",
  ),
  publishingImports: Empty(
    "Imports",
    "Use the legacy JSON importer and AI Studio drafts while the V2 unified importer is built.",
    [
      { label: "JSON Importer (legacy)", to: "/admin/publishing/imports/json" },
      { label: "AI Studio (legacy)", to: "/admin/publishing/imports/ai-studio" },
    ],
  ),
  publishingImportsJson: wrap(<JsonPromptImporter />),
  publishingImportsAiStudio: wrap(<AiStudioPage />),
  publishingTaxonomy: wrap(<CategoriesManagement />),

  // Orders
  orders: wrap(<PurchaseHistoryManagement />),
  paymentEvents: Empty(
    "Payment Events",
    "Provider webhooks (created / authorized / captured / failed / refunded / chargeback / reversal) will render here with reconciliation status. Data lives in payment_events.",
  ),
  entitlements: Empty(
    "Entitlements",
    "Grants ledger from the entitlements table with scope, grant reason, expiry, and revoke controls. Read-only inspection available today via the database; UI lands next.",
  ),
  refunds: Empty(
    "Refunds",
    "Refund requests, approvals, and processed refunds from the refunds table. UI is scaffolded but pending Phase 2.",
  ),
  ordersRecovery: wrap(<AbandonedCartDashboard />),
  discounts: wrap(<DiscountCodesManagement />),

  // People
  users: wrap(<UsersManagement />),

  // Communications
  emailTemplates: wrap(<EmailTemplatesManagement />),
  emailAnalytics: wrap(<EmailAnalyticsDashboard />),

  // Trust & Activity
  trustReports: Empty(
    "Reports",
    "User-submitted reports on resources from the reports table with triage workflow. UI lands next.",
  ),
  trustScans: Empty(
    "Package Scans",
    "Latest package_scans by resource version with re-scan controls. Currently viewable via the Catalog table's Scan column.",
    [{ label: "Open Catalog", to: "/admin/catalog" }],
  ),
  audit: wrap(<AuditLogPage />),
  security: wrap(<SecurityMonitoringDashboard />),

  // Settings
  settingsPayments: Empty(
    "Payments",
    "Provider configuration (Tap / MyFatoorah / Stripe), fee mapping, and test-mode toggles. Unavailable in Phase 1.",
  ),
  settingsEmail: Empty(
    "Email",
    "Sender identity, DKIM/SPF status, and template defaults. Unavailable in Phase 1.",
  ),
  settingsStorage: Empty(
    "Storage",
    "Bucket policies for resource-packages and public assets. Unavailable in Phase 1.",
  ),
  settingsIntegrations: Empty(
    "Integrations",
    "Third-party integrations (MCP, analytics, webhooks). Unavailable in Phase 1.",
  ),
  settingsRoles: Empty(
    "Roles",
    "Admin role assignments backed by user_roles + has_role(). Currently managed via People → Users.",
    [{ label: "Open Users", to: "/admin/users" }],
  ),
};
