import type { ReactNode } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { adminSectionElements } from "./adminSectionElements";
import { resolveLegacyAdminPath } from "./adminRouteCompatibility";

type Workspace = "content" | "commerce" | "people" | "operations" | "settings";

interface WorkspaceTab {
  id: string;
  label: string;
  element: ReactNode;
}

const WORKSPACE_TABS: Record<Exclude<Workspace, "content">, WorkspaceTab[]> = {
  commerce: [
    { id: "orders", label: "Orders", element: adminSectionElements.orders },
    { id: "payment-events", label: "Payment events", element: adminSectionElements.paymentEvents },
    { id: "entitlements", label: "Entitlements", element: adminSectionElements.entitlements },
    { id: "refunds", label: "Refunds", element: adminSectionElements.refunds },
    { id: "recovery", label: "Recovery", element: adminSectionElements.ordersRecovery },
    { id: "discounts", label: "Discounts", element: adminSectionElements.discounts },
  ],
  people: [
    { id: "users", label: "Users", element: adminSectionElements.users },
    { id: "roles", label: "Roles", element: adminSectionElements.settingsRoles },
  ],
  operations: [
    { id: "templates", label: "Templates", element: adminSectionElements.emailTemplates },
    { id: "delivery", label: "Delivery", element: adminSectionElements.emailAnalytics },
    { id: "reports", label: "Reports", element: adminSectionElements.trustReports },
    { id: "scans", label: "Package scans", element: adminSectionElements.trustScans },
    { id: "admin-activity", label: "Admin activity", element: adminSectionElements.audit },
    { id: "security-events", label: "Security events", element: adminSectionElements.security },
  ],
  settings: [
    { id: "payments", label: "Payments", element: adminSectionElements.settingsPayments },
    { id: "email", label: "Email", element: adminSectionElements.settingsEmail },
    { id: "storage", label: "Storage", element: adminSectionElements.settingsStorage },
    { id: "integrations", label: "Integrations", element: adminSectionElements.settingsIntegrations },
  ],
};

const CONTENT_TABS: WorkspaceTab[] = [
  { id: "catalog", label: "Catalog", element: adminSectionElements.catalog },
  { id: "drafts", label: "Drafts", element: adminSectionElements.publishingDrafts },
  { id: "review", label: "Review queue", element: adminSectionElements.publishingReview },
  { id: "versions", label: "Versions", element: adminSectionElements.publishingVersions },
  { id: "imports", label: "Imports", element: adminSectionElements.publishingImports },
  { id: "taxonomy", label: "Taxonomy", element: adminSectionElements.publishingTaxonomy },
];

const CATALOG_BY_TYPE: Record<string, ReactNode> = {
  skill: adminSectionElements.catalogSkills,
  automation: adminSectionElements.catalogAutomations,
  prompt: adminSectionElements.catalogPrompts,
  prompt_pack: adminSectionElements.catalogPromptPacks,
  image_style: adminSectionElements.catalogImageStyles,
  bundle: adminSectionElements.catalogBundles,
};

function WorkspaceTabs({ workspace, tabs, active }: { workspace: Workspace; tabs: WorkspaceTab[]; active: string }) {
  return (
    <nav
      aria-label={`${workspace} workspace sections`}
      className="-mx-3 mb-5 overflow-x-auto border-b border-gray-200 px-3 sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6"
    >
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={`/admin/${workspace}?tab=${encodeURIComponent(tab.id)}`}
            aria-current={active === tab.id ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[44px] items-center border-b-2 px-3 text-sm font-medium transition-colors",
              active === tab.id
                ? "border-warm-gold text-dark-base"
                : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-dark-base",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function ContentWorkspace() {
  const [params] = useSearchParams();
  const tool = params.get("tool");
  const resourceId = params.get("resourceId");
  const draftId = params.get("draftId");

  if (tool === "new") return adminSectionElements.publishingNew;
  if (tool === "edit") {
    return resourceId
      ? adminSectionElements.publishingEditFor(resourceId)
      : <Navigate to="/admin/content" replace />;
  }
  if (tool === "new-version") {
    return resourceId
      ? adminSectionElements.publishingNewVersionFor(resourceId)
      : <Navigate to="/admin/content" replace />;
  }
  if (tool === "import-json") return adminSectionElements.publishingImportsJson;
  if (tool === "import-legacy") return adminSectionElements.publishingImportsLegacy;
  if (tool === "ai-studio") return adminSectionElements.publishingImportsAiStudioFor(draftId ?? undefined);
  if (tool) return <Navigate to="/admin/content" replace />;

  const requested = params.get("tab") ?? "catalog";
  const active = CONTENT_TABS.some((tab) => tab.id === requested) ? requested : "catalog";
  const type = params.get("type") ?? "";
  const element = active === "catalog"
    ? (CATALOG_BY_TYPE[type] ?? adminSectionElements.catalog)
    : CONTENT_TABS.find((tab) => tab.id === active)!.element;

  return (
    <>
      <WorkspaceTabs workspace="content" tabs={CONTENT_TABS} active={active} />
      {element}
    </>
  );
}

export function AdminWorkspacePage({ workspace }: { workspace: Workspace }) {
  const [params] = useSearchParams();
  if (workspace === "content") return <ContentWorkspace />;

  const tabs = WORKSPACE_TABS[workspace];
  const requested = params.get("tab") ?? tabs[0].id;
  const active = tabs.some((tab) => tab.id === requested) ? requested : tabs[0].id;
  const element = tabs.find((tab) => tab.id === active)!.element;

  return (
    <>
      <WorkspaceTabs workspace={workspace} tabs={tabs} active={active} />
      {element}
    </>
  );
}

function appendSafeSearch(destination: string, incoming: string): string {
  if (!incoming) return destination;
  const url = new URL(destination, "https://admin.local");
  const source = new URLSearchParams(incoming);
  source.forEach((value, key) => {
    if (!["tab", "type", "tool", "resourceId", "draftId"].includes(key)) {
      url.searchParams.set(key, value);
    }
  });
  return `${url.pathname}${url.search}`;
}

export function AdminCompatibilityResolver() {
  const { pathname, search } = useLocation();
  const splat = pathname.replace(/^\/admin\/?/, "");
  return <Navigate to={appendSafeSearch(resolveLegacyAdminPath(splat), search)} replace />;
}
