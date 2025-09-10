# ⚠️ DEPRECATED GUARD COMPONENTS

The following guard components have been **deprecated** in favor of the new unified `Guard` system:

## Deprecated Components

### ProtectedRoute.tsx
- **Status**: Deprecated in Phase 2
- **Replaced by**: `AuthGuard` from `Guard.tsx`
- **Migration**: Replace `<ProtectedRoute>` with `<AuthGuard>`

### RouteGuard.tsx  
- **Status**: Deprecated in Phase 2
- **Replaced by**: `RoleGuard` or `AdminGuard` from `Guard.tsx`
- **Migration**: 
  - `<RouteGuard requiredRole="admin">` → `<AdminGuard>`
  - `<RouteGuard requiredRole="prompter">` → `<RoleGuard role="prompter">`

### SubscriptionGuard.tsx
- **Status**: Deprecated in Phase 2
- **Replaced by**: `PremiumGuard` or `AuthPremiumGuard` from `Guard.tsx` 
- **Migration**: Replace `<SubscriptionGuard>` with `<PremiumGuard>`

## Migration Guide

### Before (Deprecated)
```tsx
// Old nested approach
<ProtectedRoute>
  <SubscriptionGuard>
    <ComponentName />
  </SubscriptionGuard>
</ProtectedRoute>

// Old role-based approach
<RouteGuard requiredRole="admin" fallbackRoute="/prompts">
  <ComponentName />
</RouteGuard>
```

### After (New Unified System)
```tsx
// New unified approach
<AuthPremiumGuard>
  <ComponentName />
</AuthPremiumGuard>

// New role-based approach
<AdminGuard fallbackRoute="/prompts">
  <ComponentName />
</AdminGuard>
```

## Benefits of New System

1. **Single Component**: One Guard component handles all access control
2. **Better Performance**: Eliminates nested component overhead
3. **More Flexible**: Permission-based and feature-based access control
4. **Better Logging**: Integrated security event logging
5. **Consistent UX**: Unified loading states and error messages

## Timeline

- **Phase 1** ✅ - New Guard system implemented
- **Phase 2** ✅ - All App.tsx routes migrated
- **Phase 3** 🔄 - Mark components as deprecated, update documentation
- **Phase 4** 📅 - Remove deprecated components after transition period

## Support

If you encounter issues during migration:
1. Check the new Guard component documentation
2. Compare old vs new implementations in App.tsx
3. Ensure all props are correctly mapped to new system