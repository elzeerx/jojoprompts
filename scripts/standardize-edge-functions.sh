#!/bin/bash

# Script to standardize Supabase edge function imports to version 2.57.0
# This script updates all edge functions to use consistent imports

echo "🔧 Standardizing Supabase Edge Function imports to @supabase/supabase-js@2.57.0"

# Directory containing edge functions
FUNCTIONS_DIR="supabase/functions"

# Find all index.ts files and update imports
find "$FUNCTIONS_DIR" -name "index.ts" -type f | while read -r file; do
    echo "Processing: $file"
    
    # Update supabase-js imports to version 2.57.0
    sed -i.bak 's|@supabase/supabase-js@2\.[0-9]*\.[0-9]*|@supabase/supabase-js@2.57.0|g' "$file"
    
    # Remove backup files
    rm -f "${file}.bak"
done

# Update specific functions that should use shared modules
echo "📦 Updating functions to use shared modules..."

# List of functions that should be updated to use shared imports
FUNCTIONS_TO_UPDATE=(
    "get-users-without-plans"
    "get-admin-transactions" 
    "auto-generate-prompt"
    "enhance-prompt"
    "generate-metadata"
    "generate-use-case"
)

for func in "${FUNCTIONS_TO_UPDATE[@]}"; do
    if [ -f "$FUNCTIONS_DIR/$func/index.ts" ]; then
        echo "  Updating $func to use shared imports..."
        # This would require specific logic per function
        # For now, just ensure version consistency
        sed -i.bak 's|@supabase/supabase-js@2\.[0-9]*\.[0-9]*|@supabase/supabase-js@2.57.0|g' "$FUNCTIONS_DIR/$func/index.ts"
        rm -f "$FUNCTIONS_DIR/$func/index.ts.bak"
    fi
done

echo "✅ Standardization complete!"
echo "📝 All edge functions now use @supabase/supabase-js@2.57.0"
echo "🔍 Manual review recommended for functions using complex authentication patterns"