#!/bin/bash

# Script to systematically update console.log calls to use unified logging
echo "🔧 Updating frontend logging to use unified logger"

# Critical files to update (authentication, security, admin)
CRITICAL_FILES=(
    "src/contexts/AuthContext.tsx"
    "src/components/auth/LoginForm.tsx"
    "src/components/auth/hooks/useSignupForm.ts" 
    "src/components/layout/header.tsx"
    "src/pages/admin/components/users/hooks/useUserManagement.ts"
    "src/components/admin/SecurityMonitoringDashboard.tsx"
    "src/utils/securityHeaders.ts"
    "src/components/SecurityMonitoringWrapper.tsx"
)

# Pattern replacements for common console usage
declare -A REPLACEMENTS=(
    ["console.error(\""]="logger.error(\""
    ["console.warn(\""]="logger.warn(\""
    ["console.info(\""]="logger.info(\""
    ["console.log(\""]="logger.info(\""
    ["console.debug(\""]="logger.debug(\""
)

echo "📝 Processing critical files..."

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  Processing: $file"
        
        # Add logger import if not present
        if ! grep -q "createLogger\|import.*logging" "$file"; then
            # Find the line with other imports and add after them
            sed -i '/^import.*from/a import { createLogger } from "@/utils/logging";' "$file"
        fi
        
        # Replace console calls (basic patterns)
        for pattern in "${!REPLACEMENTS[@]}"; do
            replacement="${REPLACEMENTS[$pattern]}"
            sed -i "s/$pattern/$replacement/g" "$file"
        done
        
        echo "    ✓ Updated $file"
    else
        echo "    ⚠️  File not found: $file"
    fi
done

echo "🔍 Finding remaining console usage..."
echo "Files with remaining console.log calls:"
grep -r "console\." src/ --include="*.ts" --include="*.tsx" | wc -l

echo "✅ Logging migration script complete"
echo "📋 Manual review recommended for:"
echo "  - Context-specific logger creation"
echo "  - Security event logging"
echo "  - Error handling patterns"