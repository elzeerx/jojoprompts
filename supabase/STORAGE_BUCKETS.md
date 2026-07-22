# Supabase Storage Bucket Provenance

Some Supabase-hosted projects disallow direct `INSERT INTO storage.buckets`
from user migrations. Buckets required by this project are therefore
bootstrapped through the Supabase Management API / dashboard tool and
documented here so the configuration is reproducible from Git.

If your platform *does* permit bucket inserts from migrations, run the
idempotent bootstrap in `supabase/bootstrap_storage.sql` after applying
migrations. It uses `ON CONFLICT` so it is safe to re-run.

## Required buckets

| Name                | Public | Purpose                                     |
| ------------------- | ------ | ------------------------------------------- |
| `resource-packages` | false  | Private V2 resource downloads (signed URLs) |

### Recreation commands

Preferred (Lovable / Supabase tool):

```
supabase--storage_create_bucket { "name": "resource-packages", "public": false }
```

Or via Supabase CLI:

```
supabase storage create resource-packages --private
```

Or via SQL bootstrap (only where INSERT on `storage.buckets` is permitted):

```
\i supabase/bootstrap_storage.sql
```

Do **not** add client-side policies on `storage.objects` for
`resource-packages`; access is granted exclusively through server-side
signed URLs produced by entitlement-checked edge functions.
