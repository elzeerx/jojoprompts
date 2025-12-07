import React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  allLabel?: string;
  className?: string;
}

/**
 * Unified category filter component with pill-style mobile and grid desktop layouts
 */
export function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
  allLabel = 'All',
  className
}: CategoryFilterProps) {
  const { isRTL } = useLanguage();
  
  return (
    <div className={className}>
      {/* Mobile: Horizontal scroll with pill buttons */}
      <div className="md:hidden relative">
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <div className={cn(
            "flex gap-2 px-1 min-w-max",
            isRTL && "flex-row-reverse"
          )}>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => onCategoryChange(category)}
                className={cn(
                  "py-2.5 px-4 text-sm font-medium rounded-full whitespace-nowrap",
                  "transition-colors duration-200 min-h-[44px] touch-manipulation",
                  selectedCategory === category 
                    ? 'bg-warm-gold text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {category === 'all' ? allLabel : category}
              </button>
            ))}
          </div>
        </div>
        {/* Fade gradient indicator */}
        <div className={cn(
          "absolute top-0 bottom-2 w-12 pointer-events-none",
          isRTL 
            ? "left-0 bg-gradient-to-r from-white via-white/80 to-transparent"
            : "right-0 bg-gradient-to-l from-white via-white/80 to-transparent"
        )} />
      </div>
      
      {/* Desktop: Gap-px grid pattern */}
      <div className={cn(
        "hidden md:grid gap-px bg-gray-200 rounded-xl overflow-hidden",
        `grid-cols-${Math.min(categories.length, 6)}`
      )} style={{ gridTemplateColumns: `repeat(${Math.min(categories.length, 6)}, 1fr)` }}>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={cn(
              "py-3 px-4 text-sm font-medium transition-colors duration-200",
              selectedCategory === category 
                ? 'bg-warm-gold/5 text-warm-gold' 
                : 'bg-white text-muted-foreground hover:bg-gray-50/50'
            )}
          >
            {category === 'all' ? allLabel : category}
          </button>
        ))}
      </div>
    </div>
  );
}

interface FilterPillProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Individual filter pill button
 */
export function FilterPill({ label, isActive, onClick, className }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "py-2 px-4 text-sm font-medium rounded-full whitespace-nowrap",
        "transition-colors duration-200 min-h-[40px] touch-manipulation",
        isActive 
          ? 'bg-warm-gold text-white' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        className
      )}
    >
      {label}
    </button>
  );
}

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

/**
 * Removable filter chip (for active filters display)
 */
export function FilterChip({ label, onRemove, className }: FilterChipProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 py-1 px-3 text-xs font-medium",
      "bg-warm-gold/10 text-warm-gold rounded-full",
      className
    )}>
      {label}
      <button
        onClick={onRemove}
        className="ml-1 hover:text-warm-gold/70 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
