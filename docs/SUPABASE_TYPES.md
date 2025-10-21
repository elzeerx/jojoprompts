# Supabase Types Management

## ⚠️ CRITICAL: Do NOT Manually Edit Types

The file `src/integrations/supabase/types.ts` is **automatically generated** by Supabase and should **NEVER** be manually edited.

## Type Generation Process

### Automatic Generation
Types are automatically regenerated when:
- Database schema changes via migrations
- Supabase CLI detects schema changes
- Manual regeneration is triggered

### Manual Regeneration (when needed)
If types become out of sync, regenerate them using:

```bash
# Using Supabase CLI (recommended)
npx supabase gen types typescript --project-id fxkqgjakbyrxkmevkglv > src/integrations/supabase/types.ts

# Alternative: Via Supabase dashboard
# Go to Settings > API > Generate Types
```

## Best Practices

### ✅ DO
- Use the generated types for all database operations
- Create separate interface files for extended types
- Import types from `@/integrations/supabase/types`
- Let migrations trigger automatic type updates

### ❌ DON'T
- Manually edit `src/integrations/supabase/types.ts`
- Add custom types to the generated file
- Commit manual changes to the types file
- Ignore type errors (they indicate schema mismatches)

## Custom Type Extensions

For custom types and extensions, create separate files:

```typescript
// src/types/custom-database.ts
import { Database } from '@/integrations/supabase/types';

export interface ExtendedProfile extends Database['public']['Tables']['profiles']['Row'] {
  // Add custom fields here
  display_name?: string;
}
```

## Troubleshooting

### Types Out of Sync
1. Check if recent migrations were applied
2. Regenerate types manually
3. Restart development server
4. Clear TypeScript cache

### Missing Types
- Ensure tables have proper RLS policies
- Check if columns exist in database
- Verify migration was successful

## Project Configuration

- **Project ID**: `fxkqgjakbyrxkmevkglv`
- **Types File**: `src/integrations/supabase/types.ts` (READ ONLY)
- **Custom Types**: `src/types/` directory