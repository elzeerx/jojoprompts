import type { ReactNode } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { adminSectionElements } from "./adminSectionElements";

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

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

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
  const { "*": splat = "" } = useParams<{ "*": string }>();
  const [params] = useSearchParams();

  if (splat === "new") return adminSectionElements.publishingNew;

  const edit = /^resources\/([^/]+)\/edit$/.exec(splat);
  if (edit) {
    const id = safeDecode(edit[1]);
    return id ? adminSectionElements.publishingEditFor(id) : <Navigate to="/admin/content" replace />;
  }

  const version = /^resources\/([^/]+)\/versions\/new$/.exec(splat);
  if (version) {
    const id = safeDecode(version[1]);
    return id ? adminSectionElements.publishingNewVersionFor(id) : <Navigate to="/admin/content" replace />;
  }

  if (splat === "imports/json") return adminSectionElements.publishingImportsJson;
  if (splat === "imports/legacy") return adminSectionElements.publishingImportsLegacy;
  if (splat === "imports/ai-studio") return adminSectionElements.publishingImportsAiStudioFor();

  const draft = /^imports\/ai-studio\/([^/]+)$/.exec(splat);
  if (draft) {
    const id = safeDecode(draft[1]);
    return id ? adminSectionElements.publishingImportsAiStudioFor(id) : <Navigate to="/admin/content" replace />;
  }

  if (splat) return <Navigate to="/admin/content" replace />;

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

const LEGACY_ADMIN_PATHS: Record<string, string> = {
  analytics: "/admin",
  catalog: "/admin/content",
  "catalog/skills": "/admin/content?type=skill",
  "catalog/automations": "/admin/content?type=automation",
  "catalog/prompts": "/admin/content?type=prompt",
  "catalog/prompt-packs": "/admin/content?type=prompt_pack",
  "catalog/image-styles": "/admin/content?type=image_style",
  "catalog/bundles": "/admin/content?type=bundle",
  "publishing/drafts": "/admin/content?tab=drafts",
  "publishing/review": "/admin/content?tab=review",
  "publishing/versions": "/admin/content?tab=versions",
  "publishing/imports": "/admin/content?tab=imports",
  "publishing/imports/legacy": "/admin/content/imports/legacy",
  "publishing/imports/json": "/admin/content/imports/json",
  "publishing/imports/ai-studio": "/admin/content/imports/ai-studio",
  "publishing/taxonomy": "/admin/content?tab=taxonomy",
  orders: "/admin/commerce?tab=orders",
  "orders/payment-events": "/admin/commerce?tab=payment-events",
  "orders/entitlements": "/admin/commerce?tab=entitlements",
  "orders/refunds": "/admin/commerce?tab=refunds",
  "orders/recovery": "/admin/commerce?tab=recovery",
  "orders/discounts": "/admin/commerce?tab=discounts",
  users: "/admin/people?tab=users",
  "communications/templates": "/admin/operations?tab=templates",
  "communications/delivery": "/admin/operations?tab=delivery",
  "trust/reports": "/admin/operations?tab=reports",
  "trust/scans": "/admin/operations?tab=scans",
  "trust/admin-activity": "/admin/operations?tab=admin-activity",
  "trust/security-events": "/admin/operations?tab=security-events",
  "settings/payments": "/admin/settings?tab=payments",
  "settings/email": "/admin/settings?tab=email",
  "settings/storage": "/admin/settings?tab=storage",
  "settings/integrations": "/admin/settings?tab=integrations",
  "settings/roles": "/admin/people?tab=roles",
  prompts: "/admin/content?type=prompt",
  "prompts/import": "/admin/content?tab=imports",
  "ai-studio": "/admin/content/imports/ai-studio",
  categories: "/admin/content?tab=taxonomy",
  purchases: "/admin/commerce?tab=orders",
  "abandoned-cart": "/admin/commerce?tab=recovery",
  emails: "/admin/operations?tab=templates",
  "emails/templates": "/admin/operations?tab=templates",
  "emails/analytics": "/admin/operations?tab=delivery",
  "emails/marketing": "/admin/operations?tab=templates",
  security: "/admin/operations?tab=security-events",
  audit: "/admin/operations?tab=admin-activity",
};

function appendSafeSearch(destination: string, incoming: string): string {
  if (!incoming) return destination;
  const url = new URL(destination, "https://admin.local");
  const source = new URLSearchParams(incoming);
  source.forEach((value, key) => {
    if (key !== "tab" && key !== "type") url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}`;
}

export function AdminCompatibilityResolver() {
  const { "*": splat = "" } = useParams<{ "*": string }>();
  const { search } = useLocation();

  const publisher = /^publishing\/resources\/([^/]+)\/(edit|versions\/new)$/.exec(splat);
  if (publisher) {
    const decoded = safeDecode(publisher[1]);
    if (decoded) return <Navigate to={`/admin/content/resources/${encodeURIComponent(decoded)}/${publisher[2]}`} replace />;
  }

  const draft = /^(?:publishing\/imports\/)?ai-studio\/([^/]+)$/.exec(splat);
  if (draft) {
    const decoded = safeDecode(draft[1]);
    if (decoded) return <Navigate to={`/admin/content/imports/ai-studio/${encodeURIComponent(decoded)}`} replace />;
  }

  const destination = LEGACY_ADMIN_PATHS[splat];
  return <Navigate to={destination ? appendSafeSearch(destination, search) : "/admin"} replace />;
}
