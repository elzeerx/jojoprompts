import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const migration = read(
  "supabase/migrations/20260728185445_secure_versioned_resource_content.sql",
);
const lifecycleMigration = read(
  "supabase/migrations/20260727073236_01e70ade-6266-49d3-9ad0-7983f7f459c1.sql",
);
const publisher = read(
  "src/pages/admin/sections/publishing/ResourcePublisher.tsx",
);
const aiPublishDialog = read(
  "src/pages/admin/sections/ai-studio/PublishDialog.tsx",
);
const resourceDetail = read("src/hooks/v2/useResourceDetail.ts");
const explore = read("src/hooks/v2/useExploreResources.ts");
const infiniteExplore = read("src/hooks/v2/useInfiniteExploreResources.ts");
const latest = read("src/hooks/v2/useLatestPublishedResources.ts");
const library = read("src/pages/v2/LibraryPage.tsx");
const libraryState = read("src/hooks/v2/useLibraryState.ts");
const authoritativeCart = read("src/hooks/v2/useAuthoritativeCart.ts");

describe("secure versioned resource content", () => {
  it("keeps delivery content in a forced-RLS private table", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS private.resource_version_contents",
    );
    expect(migration).toContain(
      "ALTER TABLE private.resource_version_contents FORCE ROW LEVEL SECURITY",
    );
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE private\.resource_version_contents\s+FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toContain(
      "resource_version_contents_published_immutable",
    );
    expect(migration).toContain("protected_content_table_exposed");
    expect(migration).toContain(
      "protected_content_rpc_exposed_to_anon",
    );
  });

  it("separates the admin working version from the customer published version", () => {
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS latest_published_version_id uuid",
    );
    expect(migration).toContain(
      "latest_published_version_id = v_r.current_version_id",
    );
    expect(migration).toContain("AND rv.published_at IS NOT NULL");
    expect(migration).toContain("r.latest_published_version_id");
    expect(migration).toContain("latest_published_version_required");
    expect(migration).toContain(
      "resource_versions_published_reference_immutable",
    );
    expect(migration).toContain(
      "resource_versions_published_reference_delete",
    );
    expect(migration).toContain(
      "referenced_published_version_immutable",
    );
    expect(publisher).toContain("hasPublishedVersion");
    expect(publisher).toContain(
      "Restore it from Catalog before editing",
    );
  });

  it("prevents unpublished package files from being listed or authorized", () => {
    const publishedChecks =
      migration.match(/AND rv\.published_at IS NOT NULL/g) ?? [];
    expect(publishedChecks.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.get_my_downloadable_files",
    );
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.authorize_resource_download",
    );
    expect(migration).toContain(
      "public.v2_internal_effective_scan_state(rv.id)",
    );
    expect(publisher).toContain(
      "existing.current_version?.published_at",
    );
    expect(publisher).toContain("Published packages are");
  });

  it("uses one entitlement-aware published-version selector for protected content", () => {
    expect(migration).toContain(
      "private._v2_entitled_resource_version(p_resource_id, v_user)",
    );
    expect(migration).toContain(
      "e.scope = 'collection'::public.v2_entitlement_scope",
    );
    expect(migration).toContain(
      "'owned_resource_ids', to_jsonb(v_owned_resource_ids)",
    );
    expect(libraryState).toContain("owned_resource_ids: string[]");
  });

  it("uses authoritative ownership and the real bundle membership key in cart checks", () => {
    expect(authoritativeCart).toContain(
      "library?.owned_resource_ids ?? []",
    );
    expect(authoritativeCart).toContain(
      '.select("bundle_product_id, resource_id")',
    );
    expect(authoritativeCart).toContain(
      '.in("bundle_product_id", bundleIds)',
    );
    expect(authoritativeCart).not.toContain(
      '.select("product_id, resource_id")',
    );
  });

  it("routes AI Studio through the unified transactional publisher", () => {
    expect(aiPublishDialog).not.toContain('.from("prompts")');
    expect(aiPublishDialog).toContain('navigate("/admin/publishing/new"');
    expect(publisher).toContain('"save_admin_resource_draft_v2"');
    expect(publisher).toContain("source_ai_studio_draft_id");
    expect(migration).toContain("published_resource_id = v_resource_id");
  });

  it("pins every public resource surface to latest_published_version_id", () => {
    for (const source of [
      resourceDetail,
      explore,
      infiniteExplore,
      latest,
      library,
    ]) {
      expect(source).toContain("latest_published_version_id");
    }
    expect(resourceDetail).not.toContain('"current_version_id"');
    expect(explore).not.toContain("r.current_version_id");
    expect(infiniteExplore).not.toContain("r.current_version_id");
    expect(latest).not.toContain("r.current_version_id");
  });

  it("uses the same publish validator for review and publish", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION private._v2_resource_publish_errors",
    );
    expect(migration).toContain(
      "v_errs := private._v2_resource_publish_errors(p_resource_id)",
    );
    expect(lifecycleMigration).toContain(
      "v_errs := private._v2_resource_publish_errors(p_resource_id)",
    );
    expect(migration).toContain("missing_private_content");
    expect(migration).toContain("no_automation_delivery");
    expect(migration).toContain("missing_license");
  });
});
