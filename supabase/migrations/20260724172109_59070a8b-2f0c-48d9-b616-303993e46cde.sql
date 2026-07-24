
-- Phase 6D follow-up: preserve minimum grants required by existing admin read paths.
-- Direct table SELECT is required by:
--   src/pages/admin/sections/publishing/PackageUploader.tsx (resource_files, package_scans)
--   src/pages/admin/sections/catalog/CatalogTable.tsx      (package_scans)
-- RLS admin-only policies remain the authoritative gate; grants alone do not expose data.
-- All write privileges remain revoked from anon/authenticated so all writes must flow
-- through the SECURITY DEFINER RPC v2_internal_register_resource_file (service_role only).

GRANT SELECT ON public.resource_files  TO authenticated;
GRANT SELECT ON public.package_scans   TO authenticated;

-- service_role continues to have full access for edge functions and the internal RPC path.
GRANT ALL ON public.resource_files  TO service_role;
GRANT ALL ON public.package_scans   TO service_role;

-- Explicitly ensure no privileges leak to anon.
REVOKE ALL ON public.resource_files  FROM anon, PUBLIC;
REVOKE ALL ON public.package_scans   FROM anon, PUBLIC;
