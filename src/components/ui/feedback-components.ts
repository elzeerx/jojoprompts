/**
 * UI Loading States & Feedback Components
 * 
 * Unified loading, empty, and error state components for consistent UX.
 * 
 * @example
 * import { PageLoadingState, EmptyState, ErrorState } from '@/components/ui/loading-states';
 * import { CategoryFilter } from '@/components/ui/category-filter';
 */

export { 
  LoadingSpinner,
  PageLoadingState,
  SectionLoadingState,
  PromptGridSkeleton,
  PromptCardSkeleton,
  InlineLoadingDots,
  EmptyState,
  ErrorState
} from './loading-states';

export type {
  // Re-export types if needed
} from './loading-states';

export {
  CategoryFilter,
  FilterPill,
  FilterChip
} from './category-filter';
