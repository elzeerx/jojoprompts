import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  "src/pages/admin/sections/ai-studio/AiStudioPage.tsx",
  "utf8",
);
const sidebarSource = readFileSync(
  "src/pages/admin/sections/ai-studio/DraftsSidebar.tsx",
  "utf8",
);
const routesSource = readFileSync(
  "src/pages/admin/sections/ai-studio/routes.ts",
  "utf8",
);
const appSource = readFileSync("src/App.tsx", "utf8");
const publishDialogSource = readFileSync(
  "src/pages/admin/sections/ai-studio/PublishDialog.tsx",
  "utf8",
);
const draftHookSource = readFileSync(
  "src/pages/admin/sections/ai-studio/useAiStudioDraft.ts",
  "utf8",
);

describe("AI Studio Admin V2 contract", () => {
  it("uses only the canonical Content workspace route for draft navigation", () => {
    expect(routesSource).toContain(
      '"/admin/content/imports/ai-studio"',
    );
    expect(pageSource).not.toContain('`/admin/ai-studio/');
    expect(sidebarSource).not.toContain('`/admin/ai-studio/');
    expect(pageSource).toContain("AI_STUDIO_BASE_ROUTE");
    expect(sidebarSource).toContain("AI_STUDIO_BASE_ROUTE");
    expect(appSource).toContain('<Route path="content/*" element={<AdminWorkspacePage workspace="content" />} />');
    expect(appSource).toContain('<Route path="*" element={<AdminCompatibilityResolver />} />');
  });

  it("exposes exactly one H1 in both empty and active-draft states", () => {
    expect(pageSource).toContain(
      '<h1 className="text-lg font-semibold">AI Studio</h1>',
    );
    expect(pageSource).toContain(
      '<h1 className="sr-only">AI Studio</h1>',
    );
    expect(pageSource).not.toContain(
      '<h2 className="text-lg font-semibold">AI Studio</h2>',
    );
  });

  it("stacks the workspace on mobile and uses 44px primary controls", () => {
    expect(
      (
        pageSource.match(
          /grid-cols-1[\s\S]{0,180}lg:grid-cols-\[240px_minmax\(0,1fr\)/g,
        ) ?? []
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(pageSource).toContain("min-h-[44px]");
    expect(sidebarSource).toContain("min-h-[44px] min-w-[44px]");
    expect(sidebarSource).toContain("lg:group-focus-within:opacity-100");
  });

  it("provides an accessible loading status", () => {
    expect(pageSource).toContain('role="status"');
    expect(pageSource).toContain('aria-label="Loading AI Studio draft"');
  });

  it("archives and restores drafts instead of permanently deleting them", () => {
    expect(sidebarSource).toContain('.update({ status: restoring ? "draft" : "archived" })');
    expect(sidebarSource).toContain(
      'aria-label={`${d.status === "archived" ? "Restore" : "Archive"} draft`}',
    );
    expect(sidebarSource).not.toContain('.from("ai_studio_drafts").delete()');
    expect(sidebarSource).not.toContain("Delete draft");
  });

  it("shows a clear error when deferred draft creation fails", () => {
    expect(pageSource).toContain(
      'toast.error("Could not create the draft. Please try again.")',
    );
    expect(pageSource).toContain(
      'console.error("Failed to create AI Studio draft:", error)',
    );
  });

  it("hands assets to the unified publisher without mutating legacy prompts", () => {
    expect(publishDialogSource).toContain(
      'navigate("/admin/content/new"',
    );
    expect(publishDialogSource).toContain("buildAiStudioPublisherHandoff");
    expect(publishDialogSource).not.toContain('.from("prompts")');
    expect(draftHookSource).not.toContain('.from("prompts")');
    expect(draftHookSource).not.toContain("unpublish");
    expect(pageSource).toContain("Sent to publisher");
    expect(pageSource).toContain(
      "/admin/content/resources/${importedResourceId}/edit",
    );
  });
});
