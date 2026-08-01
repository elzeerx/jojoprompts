function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function workspaceUrl(path: string, values: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Resolve retired admin bookmarks without keeping a second page registry.
 * The resolver works from path segments instead of a table of route-shaped
 * literals, so Lovable only indexes the six canonical workspaces.
 */
export function resolveLegacyAdminPath(splat: string): string {
  const parts = splat.split("/").filter(Boolean);
  const [area, section, third, fourth] = parts;

  if (!area || area === "analytics") return "/admin";

  if (area === "catalog") {
    const types: Record<string, string> = {
      skills: "skill",
      automations: "automation",
      prompts: "prompt",
      "prompt-packs": "prompt_pack",
      "image-styles": "image_style",
      bundles: "bundle",
    };
    return workspaceUrl("/admin/content", { type: section ? types[section] : undefined });
  }

  if (area === "publishing") {
    if (section === "new") return workspaceUrl("/admin/content", { tool: "new" });
    if (section === "resources" && third) {
      const id = safeDecode(third);
      if (id && fourth === "edit") {
        return workspaceUrl("/admin/content", { tool: "edit", resourceId: id });
      }
      if (id && fourth === "versions" && parts[4] === "new") {
        return workspaceUrl("/admin/content", { tool: "new-version", resourceId: id });
      }
    }
    if (section === "imports") {
      if (third === "json") return workspaceUrl("/admin/content", { tool: "import-json" });
      if (third === "legacy") return workspaceUrl("/admin/content", { tool: "import-legacy" });
      if (third === "ai-studio") {
        const id = fourth ? safeDecode(fourth) : undefined;
        return workspaceUrl("/admin/content", { tool: "ai-studio", draftId: id ?? undefined });
      }
    }
    const tabs = new Set(["drafts", "review", "versions", "imports", "taxonomy"]);
    return workspaceUrl("/admin/content", { tab: section && tabs.has(section) ? section : undefined });
  }

  if (area === "orders") {
    const tabs = new Set(["payment-events", "entitlements", "refunds", "recovery", "discounts"]);
    return workspaceUrl("/admin/commerce", { tab: section && tabs.has(section) ? section : "orders" });
  }

  if (area === "communications") {
    return workspaceUrl("/admin/operations", { tab: section === "delivery" ? "delivery" : "templates" });
  }

  if (area === "trust") {
    const tabs = new Set(["reports", "scans", "admin-activity", "security-events"]);
    return workspaceUrl("/admin/operations", { tab: section && tabs.has(section) ? section : undefined });
  }

  if (area === "settings") {
    if (section === "roles") return workspaceUrl("/admin/people", { tab: "roles" });
    const tabs = new Set(["payments", "email", "storage", "integrations"]);
    return workspaceUrl("/admin/settings", { tab: section && tabs.has(section) ? section : undefined });
  }

  if (area === "users") return workspaceUrl("/admin/people", { tab: "users" });
  if (area === "prompts") {
    return section === "import"
      ? workspaceUrl("/admin/content", { tab: "imports" })
      : workspaceUrl("/admin/content", { type: "prompt" });
  }
  if (area === "ai-studio") {
    const id = section ? safeDecode(section) : undefined;
    return workspaceUrl("/admin/content", { tool: "ai-studio", draftId: id ?? undefined });
  }
  if (area === "categories") return workspaceUrl("/admin/content", { tab: "taxonomy" });
  if (area === "purchases") return workspaceUrl("/admin/commerce", { tab: "orders" });
  if (area === "abandoned-cart") return workspaceUrl("/admin/commerce", { tab: "recovery" });
  if (area === "emails") {
    return workspaceUrl("/admin/operations", { tab: section === "analytics" ? "delivery" : "templates" });
  }
  if (area === "security") return workspaceUrl("/admin/operations", { tab: "security-events" });
  if (area === "audit") return workspaceUrl("/admin/operations", { tab: "admin-activity" });

  return "/admin";
}
