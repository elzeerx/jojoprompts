#!/bin/bash

# Update remaining edge functions to @supabase/supabase-js@2.57.0
echo "🔧 Updating remaining edge functions to @supabase/supabase-js@2.57.0"

# Functions to update (found from search)
FUNCTIONS=(
    "ai-gpt5-metaprompt"
    "ai-json-spec"
    "auto-capture-paypal"
    "create-subscription"
    "generate-magic-link"
    "get-admin-transactions" 
    "get-image"
    "get-transaction-by-order"
    "get-user-insights"
    "get-users-without-plans"
    "magic-login"
    "paypal-webhook"
    "recover-orphaned-payments"
    "scheduled-payment-cleanup"
    "send-bulk-plan-reminders"
    "send-email"
    "send-plan-reminder"
    "smart-unsubscribe"
    "track-email-engagement"
)

for func in "${FUNCTIONS[@]}"; do
    file="supabase/functions/$func/index.ts"
    if [ -f "$file" ]; then
        echo "  Updating $func..."
        # Update to 2.57.0
        sed -i.bak 's|@supabase/supabase-js@2\.[0-9]*\.[0-9]*|@supabase/supabase-js@2.57.0|g' "$file"
        # Clean up backup
        rm -f "${file}.bak"
        echo "    ✓ Updated $func to @supabase/supabase-js@2.57.0"
    else
        echo "    ⚠️  File not found: $file"
    fi
done

echo "✅ All edge functions updated to use consistent @supabase/supabase-js@2.57.0"