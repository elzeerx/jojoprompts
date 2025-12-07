import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Unified loading state components for consistent UX across the app
 */

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Simple spinning loader icon
 */
export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <Loader2 
      className={cn(
        "animate-spin text-warm-gold",
        sizeClasses[size],
        className
      )} 
    />
  );
}

interface PageLoadingStateProps {
  message?: string;
  className?: string;
}

/**
 * Full-page centered loading state with optional message
 */
export function PageLoadingState({ 
  message = "Loading...", 
  className 
}: PageLoadingStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-h-[60vh]",
      className
    )}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-warm-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground font-light">{message}</p>
      </div>
    </div>
  );
}

interface SectionLoadingStateProps {
  message?: string;
  className?: string;
}

/**
 * Section-level loading state with progress bar effect
 */
export function SectionLoadingState({ 
  message = "Loading...", 
  className 
}: SectionLoadingStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 text-center",
      className
    )}>
      <p className="text-muted-foreground mb-2">{message}</p>
      <div className="h-1 w-48 sm:w-64 bg-secondary overflow-hidden rounded-full">
        <div className="h-full bg-warm-gold animate-pulse rounded-full w-1/2" />
      </div>
    </div>
  );
}

interface PromptGridSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton loading state for prompt card grids
 */
export function PromptGridSkeleton({ 
  count = 6, 
  className 
}: PromptGridSkeletonProps) {
  return (
    <div className={cn(
      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6",
      className
    )}>
      {Array.from({ length: count }).map((_, i) => (
        <PromptCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Single prompt card skeleton
 */
export function PromptCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="aspect-[4/3] bg-gray-200" />
      
      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        
        {/* Description */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
        </div>
        
        {/* Tags */}
        <div className="flex gap-2">
          <div className="h-6 bg-gray-100 rounded-full w-16" />
          <div className="h-6 bg-gray-100 rounded-full w-20" />
        </div>
      </div>
      
      {/* Footer skeleton */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-200 rounded-full" />
          <div className="h-3 bg-gray-100 rounded w-16" />
        </div>
        <div className="w-6 h-6 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

interface InlineLoadingDotsProps {
  className?: string;
}

/**
 * Inline loading dots for buttons or small spaces
 */
export function InlineLoadingDots({ className }: InlineLoadingDotsProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
    </span>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Empty state component for when there's no data to display
 */
export function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 text-center",
      className
    )}>
      {icon && (
        <div className="rounded-full bg-warm-gold/10 p-4 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2 text-dark-base">{title}</h3>
      {description && (
        <p className="text-muted-foreground mb-4 max-w-md text-sm sm:text-base px-4">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Error state component with optional retry action
 */
export function ErrorState({ 
  title = "Something went wrong",
  message = "An error occurred. Please try again.",
  onRetry,
  className 
}: ErrorStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 text-center",
      className
    )}>
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <svg 
          className="h-6 w-6 text-destructive" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-2 text-dark-base">{title}</h3>
      <p className="text-destructive mb-4 max-w-md text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mobile-button-secondary text-sm"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
