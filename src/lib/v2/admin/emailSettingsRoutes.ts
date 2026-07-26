// Canonical Admin V2 route mapping for the Email settings page. Kept as a leaf
// module so tests can import route constants without pulling the supabase
// client or the React tree.

export const EMAIL_NAV_LINKS: readonly {
  to: string;
  label: string;
  description: string;
}[] = [
  {
    to: "/admin/communications/templates",
    label: "Transactional templates",
    description: "Edit template content and toggle active state",
  },
  {
    to: "/admin/communications/delivery",
    label: "Delivery health",
    description: "Detailed delivery analytics and per-message logs",
  },
];
