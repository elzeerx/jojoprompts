export type CatalogViewMode = "table" | "card";

export const ADMIN_MOBILE_BREAKPOINT = 768;

export function defaultCatalogViewForWidth(width: number): CatalogViewMode {
  return width < ADMIN_MOBILE_BREAKPOINT ? "card" : "table";
}

export function getInitialCatalogView(): CatalogViewMode {
  if (typeof window === "undefined") return "table";
  return defaultCatalogViewForWidth(window.innerWidth);
}
