import { Suspense, lazy } from "react";
import { AdminSectionSkeleton } from "./AdminSectionSkeleton";
import { EmptyRouteState } from "../sections/common/EmptyRouteState";

// Real V2 sections
const OverviewV2 = lazy(() => import("../sections/overview/OverviewV2"));
const CatalogPage = lazy(() => import("../sections/catalog/CatalogPage"));
const ResourcePublisher = lazy(() => import("../sections/publishing/ResourcePublisher"));
const LegacyMigrationPreview = lazy(() => import("../sections/publishing/LegacyMigrationPreview"));
const ImportsHub = lazy(() => import("../sections/publishing/ImportsHub"));

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
const RolesPage = lazy(() => import("../sections/settings/RolesPage"));
const PaymentsPage = lazy(() => import("../sections/settings/PaymentsPage"));
const EmailSettingsPage = lazy(() => import("../sections/settings/EmailSettingsPage"));
const StorageSettingsPage = lazy(() => import("../sections/settings/StorageSettingsPage"));
const IntegrationsPage = lazy(() => import("../sections/settings/IntegrationsPage"));

// V2 People operations surface (lean; no subscription/delete UI).
const UsersV2 = lazy(() => import("../components/users/UsersV2"));

// V2 Delivery Health — canonical outbound-email operations page.
const DeliveryHealthPage = lazy(
  () => import("../sections/communications/DeliveryHealthPage"),
);

// Cross-cutting utilities and V2 pages that reuse existing surfaces.
const JsonPromptImporter = lazy(() => import("../sections/content/JsonPromptImporter"));
const AuditLogPage = lazy(() => import("../sections/system/AuditLogPage"));
const AiStudioPage = lazy(() => import("../sections/ai-studio/AiStudioPage"));
const CategoriesManagement = lazy(() =>
  import("../components/categories/CategoriesManagement").then((m) => ({
    default: m.CategoriesManagement,
  }))
);
const EmailTemplatesManagement = lazy(() =>
  import("@/components/admin/EmailTemplatesManagement").then((m) => ({
    default: m.EmailTemplatesManagement,
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
  publishingImports: wrap(<ImportsHub />),
  publishingImportsLegacy: wrap(<LegacyMigrationPreview />),
  publishingImportsJson: wrap(<JsonPromptImporter />),
  publishingImportsAiStudio: wrap(<AiStudioPage />),

  publishingTaxonomy: wrap(<CategoriesManagement />),

  // Orders (V2 commerce ops — Phase 5.2)
  orders: wrap(<OrdersV2Page />),
  paymentEvents: wrap(<PaymentEventsPage />),
  entitlements: wrap(<EntitlementsPage />),
  refunds: wrap(<RefundsPage />),
  ordersRecovery: wrap(<RecoveryPage />),
  discounts: wrap(<DiscountsPage />),

  // People
  users: wrap(<UsersV2 />),

  // Communications
  emailTemplates: wrap(<EmailTemplatesManagement />),
  emailAnalytics: wrap(<DeliveryHealthPage />),

  // Trust & Activity
  trustReports: wrap(<ReportsPage />),
  trustScans: wrap(<ScansPage />),
  audit: wrap(<AuditLogPage />),
  security: wrap(<SecurityMonitoringDashboard />),

  // Settings
  settingsPayments: wrap(<PaymentsPage />),
  settingsEmail: wrap(<EmailSettingsPage />),
  settingsStorage: wrap(<StorageSettingsPage />),
  settingsIntegrations: wrap(<IntegrationsPage />),
  settingsRoles: wrap(<RolesPage />),
};
