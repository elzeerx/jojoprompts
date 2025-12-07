import React from 'react';
import { cn } from '@/lib/utils';

interface ConfigurationSectionProps {
  modelFields?: Record<string, any>;
  modelType?: string;
  category?: string;
  isRTL?: boolean;
}

// Format field key for display
function formatFieldKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Format field value for display
function formatFieldValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function ConfigurationSection({
  modelFields,
  modelType,
  category,
  isRTL = false
}: ConfigurationSectionProps) {
  // Filter out empty fields and prepare display data
  const displayFields = Object.entries(modelFields || {})
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 6); // Limit to 6 fields for clean grid

  // If no model fields, show basic config with category/model type
  if (displayFields.length === 0) {
    const basicConfig = [
      { key: 'Model', value: modelType || category || 'Standard' },
    ];

    return (
      <div className={cn("border-t border-gray-100 pt-4 sm:pt-6", isRTL && "text-right")}>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Configuration</h4>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {basicConfig.map(({ key, value }) => (
            <div 
              key={key} 
              className="p-3 rounded-lg border border-gray-100 bg-gray-50/50"
            >
              <span className="block text-xs text-gray-400 mb-1">{key}</span>
              <span className="text-sm font-medium text-gray-700">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border-t border-gray-100 pt-4 sm:pt-6", isRTL && "text-right")}>
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Configuration</h4>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {displayFields.map(([key, value]) => (
          <div 
            key={key} 
            className="p-3 rounded-lg border border-gray-100 bg-gray-50/50"
          >
            <span className="block text-xs text-gray-400 mb-1">
              {formatFieldKey(key)}
            </span>
            <span className="text-sm font-medium text-gray-700 line-clamp-2">
              {formatFieldValue(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
