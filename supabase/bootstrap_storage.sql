-- Idempotent storage bucket bootstrap.
-- Only runs where the executing role can write to storage.buckets.
-- See supabase/STORAGE_BUCKETS.md for provenance and rationale.

insert into storage.buckets (id, name, public)
values ('resource-packages', 'resource-packages', false)
on conflict (id) do update
  set public = excluded.public;
