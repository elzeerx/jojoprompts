import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface FieldSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  className?: string;
}

/**
 * FieldSection - Organizes fields into collapsible sections
 * 
 * Provides a way to group related fields together with a title, description,
 * and optional collapse/expand functionality for better UX.
 * 
 * @example
 * ```tsx
 * <FieldSection
 *   title="Basic Settings"
 *   description="Configure basic prompt parameters"
 *   collapsible
 *   defaultOpen={true}
 * >
 *   <DynamicFieldGroup fields={basicFields} {...props} />
 * </FieldSection>
 * ```
 */
export function FieldSection({
  title,
  description,
  children,
  defaultOpen = true,
  collapsible = false,
  className
}: FieldSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("border rounded-lg p-6 space-y-4", className)}>
      {/* Section Header */}
      <div className="space-y-1">
        {collapsible ? (
          <Button
            variant="ghost"
            className="w-full justify-between p-0 h-auto hover:bg-transparent"
            onClick={() => setIsOpen(!isOpen)}
          >
            <h3 className="text-lg font-semibold">{title}</h3>
            {isOpen ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
        ) : (
          <h3 className="text-lg font-semibold">{title}</h3>
        )}
        
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Section Content */}
      {(!collapsible || isOpen) && (
        <div className="space-y-6">
          {children}
        </div>
      )}
    </div>
  );
}
