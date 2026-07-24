-- Phase 6D bucket hardening (repo-alignment only; already applied live as version 20260724172116).
-- Idempotent UPDATE mirroring the live state: private bucket remains non-public,
-- file_size_limit fixed at 26214400 (25 MiB), and the exact accepted 10-type MIME allowlist.
-- Safe to re-run; no schema changes.

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'application/json',
    'application/yaml',
    'application/x-yaml',
    'text/yaml',
    'text/x-yaml',
    'text/markdown',
    'text/plain'
  ]
WHERE id = 'resource-packages';
