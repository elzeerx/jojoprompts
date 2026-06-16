import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Lazy-load existing section components. No business logic touched.
const DashboardOverview = lazy(() => import("../components/DashboardOverview"));
const AnalyticsPage = lazy(() => import("../sections/analytics/AnalyticsPage"));
const CommunicationsLayout = lazy(
  () => import("../sections/communications/CommunicationsLayout")
);
const MarketingPage = lazy(() => import("../sections/communications/MarketingPage"));
const JsonPromptImporter = lazy(() => import("../sections/content/JsonPromptImporter"));
const PromptsManagement = lazy(() => import("../PromptsManagement"));
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

const SectionLoader = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-warm-gold" />
  </div>
);

const wrap = (Comp: React.ComponentType) => (
  <Suspense fallback={<SectionLoader />}>
    <Comp />
  </Suspense>
);

export const adminSectionElements = {
  overview: wrap(DashboardOverview),
  analytics: wrap(AnalyticsPage),
  prompts: wrap(PromptsManagement),
  categories: wrap(CategoriesManagement),
  users: wrap(UsersManagement),
  purchases: wrap(PurchaseHistoryManagement),
  discounts: wrap(DiscountCodesManagement),
  abandonedCart: wrap(AbandonedCartDashboard),
  communications: wrap(CommunicationsLayout),
  emailTemplates: wrap(EmailTemplatesManagement),
  emailAnalytics: wrap(EmailAnalyticsDashboard),
  marketing: wrap(MarketingPage),
  security: wrap(SecurityMonitoringDashboard),
};
