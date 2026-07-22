import {
  LayoutDashboard,
  Boxes,
  Wand2,
  Bot,
  FileText,
  Image as ImageIcon,
  Package,
  FileEdit,
  ClipboardCheck,
  GitBranch,
  Upload,
  Tags,
  ShoppingBag,
  CreditCard,
  KeyRound,
  RotateCcw,
  MailWarning,
  Percent,
  Users,
  Mail,
  Activity,
  Flag,
  ShieldCheck,
  ScrollText,
  ShieldAlert,
  Wallet,
  MailOpen,
  HardDrive,
  Plug,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  disabled?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/**
 * V2 admin navigation. Removes prompt-only / subscription language and
 * duplicate/dead primary entries. Retained legacy tools are surfaced from
 * inside Publishing / Orders / Trust routes as contextual links.
 */
export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Overview", to: "/admin", icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "All Resources", to: "/admin/catalog", icon: Boxes, end: true },
      { label: "Skills", to: "/admin/catalog/skills", icon: Wand2 },
      { label: "Automations", to: "/admin/catalog/automations", icon: Bot },
      { label: "Prompts", to: "/admin/catalog/prompts", icon: FileText },
      { label: "Prompt Packs", to: "/admin/catalog/prompt-packs", icon: FileText },
      { label: "Image Styles", to: "/admin/catalog/image-styles", icon: ImageIcon },
      { label: "Bundles", to: "/admin/catalog/bundles", icon: Package },

    ],
  },
  {
    label: "Publishing",
    items: [
      { label: "Drafts", to: "/admin/publishing/drafts", icon: FileEdit },
      { label: "Review Queue", to: "/admin/publishing/review", icon: ClipboardCheck },
      { label: "Versions", to: "/admin/publishing/versions", icon: GitBranch },
      { label: "Imports", to: "/admin/publishing/imports", icon: Upload },
      { label: "Taxonomy", to: "/admin/publishing/taxonomy", icon: Tags },
    ],
  },
  {
    label: "Orders",
    items: [
      { label: "Orders", to: "/admin/orders", icon: ShoppingBag, end: true },
      { label: "Payment Events", to: "/admin/orders/payment-events", icon: CreditCard },
      { label: "Entitlements", to: "/admin/orders/entitlements", icon: KeyRound },
      { label: "Refunds", to: "/admin/orders/refunds", icon: RotateCcw },
      { label: "Recovery", to: "/admin/orders/recovery", icon: MailWarning },
      { label: "Discounts", to: "/admin/orders/discounts", icon: Percent },
    ],
  },
  {
    label: "People",
    items: [{ label: "Users", to: "/admin/users", icon: Users }],
  },
  {
    label: "Communications",
    items: [
      { label: "Transactional Templates", to: "/admin/communications/templates", icon: Mail },
      { label: "Delivery Health", to: "/admin/communications/delivery", icon: Activity },
    ],
  },
  {
    label: "Trust & Activity",
    items: [
      { label: "Reports", to: "/admin/trust/reports", icon: Flag },
      { label: "Package Scans", to: "/admin/trust/scans", icon: ShieldCheck },
      { label: "Admin Activity", to: "/admin/trust/admin-activity", icon: ScrollText },
      { label: "Security Events", to: "/admin/trust/security-events", icon: ShieldAlert },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Payments", to: "/admin/settings/payments", icon: Wallet },
      { label: "Email", to: "/admin/settings/email", icon: MailOpen },
      { label: "Storage", to: "/admin/settings/storage", icon: HardDrive },
      { label: "Integrations", to: "/admin/settings/integrations", icon: Plug },
      { label: "Roles", to: "/admin/settings/roles", icon: UserCog },
    ],
  },
];

export const adminNavFlat: AdminNavItem[] = adminNavGroups.flatMap((g) => g.items);

export function findAdminNavItem(pathname: string): AdminNavItem | undefined {
  const exact = adminNavFlat.find((i) => i.to === pathname);
  if (exact) return exact;
  return adminNavFlat
    .filter((i) => i.to !== "/admin" && pathname.startsWith(i.to))
    .sort((a, b) => b.to.length - a.to.length)[0];
}
