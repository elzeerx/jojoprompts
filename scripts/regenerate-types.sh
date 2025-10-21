#!/bin/bash

# Supabase Types Regeneration Script
# This script regenerates TypeScript types from the Supabase schema

set -e

echo "🔄 Regenerating Supabase types..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Project configuration
PROJECT_ID="fxkqgjakbyrxkmevkglv"
TYPES_FILE="src/integrations/supabase/types.ts"

# Backup current types (in case of issues)
if [ -f "$TYPES_FILE" ]; then
    cp "$TYPES_FILE" "${TYPES_FILE}.backup"
    echo "📝 Created backup: ${TYPES_FILE}.backup"
fi

# Generate new types
echo "🚀 Generating types from project: $PROJECT_ID"
npx supabase gen types typescript --project-id "$PROJECT_ID" > "$TYPES_FILE"

# Verify the generated file
if [ -f "$TYPES_FILE" ] && [ -s "$TYPES_FILE" ]; then
    echo "✅ Types regenerated successfully!"
    echo "📁 File: $TYPES_FILE"
    
    # Show file info
    LINES=$(wc -l < "$TYPES_FILE")
    echo "📊 Generated $LINES lines of TypeScript types"
    
    # Clean up backup
    rm -f "${TYPES_FILE}.backup"
else
    echo "❌ Failed to generate types!"
    
    # Restore backup if available
    if [ -f "${TYPES_FILE}.backup" ]; then
        mv "${TYPES_FILE}.backup" "$TYPES_FILE"
        echo "🔄 Restored backup file"
    fi
    
    exit 1
fi

echo ""
echo "⚠️  IMPORTANT REMINDERS:"
echo "   • Never manually edit the generated types file"
echo "   • Restart your development server"
echo "   • Check for any TypeScript errors"
echo "   • Commit the updated types to version control"
echo ""
echo "🎉 Types regeneration complete!"