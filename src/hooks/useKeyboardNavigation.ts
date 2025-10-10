import { useEffect } from 'react';

export interface UseKeyboardNavigationOptions {
  onNext?: () => void;
  onBack?: () => void;
  canGoNext?: boolean;
  canGoBack?: boolean;
  enabled?: boolean;
}

/**
 * Hook to handle keyboard shortcuts for wizard navigation
 * 
 * Keyboard Shortcuts:
 * - Alt + Right Arrow: Navigate to next step
 * - Alt + Left Arrow: Navigate to previous step
 * 
 * @param options Configuration options for keyboard navigation
 */
export function useKeyboardNavigation({
  onNext,
  onBack,
  canGoNext = true,
  canGoBack = true,
  enabled = true
}: UseKeyboardNavigationOptions) {
  
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + Right Arrow = Next
      if (e.altKey && e.key === 'ArrowRight' && canGoNext && onNext) {
        e.preventDefault();
        onNext();
      }

      // Alt + Left Arrow = Back
      if (e.altKey && e.key === 'ArrowLeft' && canGoBack && onBack) {
        e.preventDefault();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onBack, canGoNext, canGoBack, enabled]);
}
