import { Suspense, lazy } from "react";
import { AdminSectionSkeleton } from "./AdminSectionSkeleton";
import { EmptyRouteState } from "../sections/common/EmptyRouteState";

// Real V2 sections
const OverviewV2 = lazy(() => import("../sections/overview/OverviewV2"));
const CatalogPage = lazy(() => import("../sections/catalog/CatalogPage"));
const ResourcePublisher = lazy(() => import("../sections/publishing/ResourcePublisher"));
const LegacyMigrationPreview = lazy(() => import("../sections/publishing/LegacyMigrationPreview"));
const OrdersV2Page = lazy(() => import("../sections/orders/OrdersV2Page"));
const PaymentEventsPage = lazy(() => import("../sections/orders/PaymentEventsPage"));
const EntitlementsPage = lazy(() => import("../sections/orders/EntitlementsPage"));
const RefundsPage = lazy(() => import("../sections/orders/RefundsPage"));
const RecoveryPage = lazy(() => import("../sections/orders/RecoveryPage"));
const DiscountsPage = lazy(() => import("../sections/orders/DiscountsPage"));
const ReportsPage = lazy(() => import("../sections/trust/ReportsPage"));
const VersionsRegistryPage = lazy(() => import("../sections/publishing/VersionsRegistryPage"));
const ScansPage = lazy(() => import("../sections/trust/scans/ScansPage"));
const DraftsQueuePage = lazy(() => import("../sections/publishing/DraftsQueuePage"));
const ReviewQueuePage = lazy(() => import("../sections/publishing/ReviewQueuePage"));




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
  publishingDrafts: wrap(<DraftsQueuePage />),
  publishingReview: wrap(<ReviewQueuePage />),
  publishingVersions: wrap(<VersionsRegistryPage />),
  publishingImports: wrap(<LegacyMigrationPreview />),
  publishingImportsJson: wrap(<JsonPromptImporter />),
  publishingImportsAiStudio: wrap(<AiStudioPage />),
  publishingTaxonomy: wrap(<CategoriesManagement />),

  // Orders (V2 commerce ops — Phase 5.2)
  orders: wrap(<OrdersV2Page />),
  paymentEvents: wrap(<PaymentEventsPage />),
  entitlements: wrap(<EntitlementsPage />),
  refunds: wrap(<RefundsPage />),
  // Legacy admin tools retained as contextual links until fully replaced.
  ordersLegacyPurchases: wrap(<PurchaseHistoryManagement />),
  ordersRecovery: wrap(<RecoveryPage />),
  discounts: wrap(<DiscountsPage />),
  discountsLegacy: wrap(<DiscountCodesManagement />),

  // People
  users: wrap(<UsersManagement />),

  // Communications
  emailTemplates: wrap(<EmailTemplatesManagement />),
  emailAnalytics: wrap(<EmailAnalyticsDashboard />),

  // Trust & Activity
  trustReports: wrap(<ReportsPage />),
  trustScans: wrap(<ScansPage />),
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
