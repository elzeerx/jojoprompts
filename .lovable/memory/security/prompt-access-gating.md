# Prompt Access Gating - Security Fix

## Issue Identified
Users were signing up but not purchasing plans because they could still access prompt content without subscribing. The security hole allowed:
1. Anonymous/unauthenticated users could see prompts via RLS policy `qual: true`
2. The "locked" overlay was only visual - prompt_text was still in the HTML/network response
3. /prompts routes were marked as "public" in routes.ts

## Solution Implemented

### Database Changes
1. Created `user_has_active_subscription(uuid)` function to check if user has active subscription
2. Updated RLS policies on prompts table:
   - `authenticated_users_can_read_prompts` - allows auth users to read (text masking in app layer)
   - `anonymous_limited_prompts_view` - allows anon to see cards but content is masked
   - `admins_full_prompts_access` - admins/jadmins have full access
   - `prompters_manage_own_prompts` - prompters can manage their own prompts

### Frontend Changes
1. **routes.ts**: Changed `/prompts/*` routes from `protection: "public"` to `protection: "premium"`
2. **PromptsPage.tsx**: Added subscription check, redirects to pricing if no active subscription
3. **ModernPromptCard.tsx**: Masks prompt_text for locked cards, shows placeholder text instead
4. **ContentBody.tsx**: Shows "🔒 Premium content" for locked prompts
5. **useSubscriptionRedirect.ts**: Added `/prompts` to premium paths requiring subscription
6. **PricingPage.tsx**: Added conversion banner when users are redirected from signup or prompts

### User Flow After Fix
1. User signs up → Redirected to /pricing with "Choose Your Plan" banner
2. User tries to access /prompts without subscription → Redirected to /pricing with "Subscription Required" banner
3. Prompt cards for locked content show placeholder text, not actual prompt_text
4. Only users with active subscriptions (or admins/prompters) can see full prompt content

## Key Files Modified
- `src/config/routes.ts` - Route protection levels
- `src/pages/prompts/PromptsPage.tsx` - Subscription check
- `src/components/ui/modern-prompt-card/ModernPromptCard.tsx` - Content masking
- `src/hooks/useSubscriptionRedirect.ts` - Premium path list
- `src/pages/PricingPage.tsx` - Conversion banners
- `src/contexts/auth/useAuthInitialization.ts` - Post-signup redirect

## Testing
- Non-subscriber accessing /prompts → Should redirect to /pricing?upgrade=true
- New signup without plan → Should redirect to /pricing?from_signup=true
- Locked prompt cards → Should show placeholder, not actual prompt_text
- Subscribers/admins → Should have full access to all content
