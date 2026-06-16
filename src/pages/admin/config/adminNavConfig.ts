import {
  LayoutDashboard,
  BarChart3,
  Shield,
  FileText,
  Tags,
  FileJson,
  CreditCard,
  Percent,
  ShoppingCart,
  Users,
  Mail,
  MailOpen,
  Send,
  ScrollText,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** end-match for NavLink (used for index routes) */
  end?: boolean;
  /** mark as upcoming/disabled */
  disabled?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/**
 * Grouped admin navigation. Routes are relative to /admin.
 * Phase 1 wires Overview, Prompts, Categories, Users, Purchases,
 * Discounts, Abandoned Cart, Email Templates, Email Analytics, Security.
 * Marketing, Analytics, JSON Importer, Audit Log are added in later phases.
 */
export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Insights",
    items: [
      { label: "Overview", to: "/admin", icon: LayoutDashboard, end: true },
      { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
      { label: "Security", to: "/admin/security", icon: Shield },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Prompts", to: "/admin/prompts", icon: FileText },
      { label: "Categories", to: "/admin/categories", icon: Tags },
      { label: "JSON Importer", to: "/admin/prompts/import", icon: FileJson },
      { label: "AI Studio", to: "/admin/ai-studio", icon: Sparkles },
    ],
  },
  {
    label: "Commerce",
    items: [
      { label: "Purchases", to: "/admin/purchases", icon: CreditCard },
      { label: "Discounts", to: "/admin/discounts", icon: Percent },
      { label: "Abandoned Cart", to: "/admin/abandoned-cart", icon: ShoppingCart },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Users", to: "/admin/users", icon: Users },
    ],
  },
  {
    label: "Communications",
    items: [
      { label: "Templates", to: "/admin/emails/templates", icon: Mail },
      { label: "Email Analytics", to: "/admin/emails/analytics", icon: MailOpen },
      { label: "Marketing", to: "/admin/emails/marketing", icon: Send },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Audit Log", to: "/admin/audit", icon: ScrollText },
    ],
  },
];

/** Flat lookup for breadcrumb / page-title resolution. */
export const adminNavFlat: AdminNavItem[] = adminNavGroups.flatMap((g) => g.items);

export function findAdminNavItem(pathname: string): AdminNavItem | undefined {
  // exact match first, then longest prefix
  const exact = adminNavFlat.find((i) => i.to === pathname);
  if (exact) return exact;
  return adminNavFlat
    .filter((i) => i.to !== "/admin" && pathname.startsWith(i.to))
    .sort((a, b) => b.to.length - a.to.length)[0];
}
