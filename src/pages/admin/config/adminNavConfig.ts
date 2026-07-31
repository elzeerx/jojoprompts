import {
  Activity,
  Boxes,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Users,
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
 * Admin V2 is organized around six jobs, not database tables. Detailed
 * screens remain available as tabs inside each workspace.
 */
export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Workspaces",
    items: [
      { label: "Overview", to: "/admin", icon: LayoutDashboard, end: true },
      { label: "Content", to: "/admin/content", icon: Boxes },
      { label: "Commerce", to: "/admin/commerce", icon: ShoppingBag },
      { label: "People", to: "/admin/people", icon: Users },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Operations", to: "/admin/operations", icon: Activity },
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

export const adminNavFlat: AdminNavItem[] = adminNavGroups.flatMap((group) => group.items);

export function findAdminNavItem(pathname: string): AdminNavItem | undefined {
  const exact = adminNavFlat.find((item) => item.to === pathname);
  if (exact) return exact;
  return adminNavFlat
    .filter((item) => item.to !== "/admin" && pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
}
