import { cn } from '@/lib/utils';

/**
 * RTL-aware utility functions for consistent directional styling
 */

/**
 * Get margin-inline-start class (left in LTR, right in RTL)
 */
export function ms(value: string, isRTL: boolean): string {
  return isRTL ? `mr-${value}` : `ml-${value}`;
}

/**
 * Get margin-inline-end class (right in LTR, left in RTL)
 */
export function me(value: string, isRTL: boolean): string {
  return isRTL ? `ml-${value}` : `mr-${value}`;
}

/**
 * Get padding-inline-start class (left in LTR, right in RTL)
 */
export function ps(value: string, isRTL: boolean): string {
  return isRTL ? `pr-${value}` : `pl-${value}`;
}

/**
 * Get padding-inline-end class (right in LTR, left in RTL)
 */
export function pe(value: string, isRTL: boolean): string {
  return isRTL ? `pl-${value}` : `pr-${value}`;
}

/**
 * Get text alignment class
 */
export function textAlign(align: 'start' | 'end' | 'center', isRTL: boolean): string {
  if (align === 'center') return 'text-center';
  if (align === 'start') return isRTL ? 'text-right' : 'text-left';
  return isRTL ? 'text-left' : 'text-right';
}

/**
 * Get flex direction class for RTL
 */
export function flexDir(direction: 'row' | 'col', isRTL: boolean): string {
  if (direction === 'col') return 'flex-col';
  return isRTL ? 'flex-row-reverse' : 'flex-row';
}

/**
 * Combine RTL-aware classes
 */
export function rtlClass(...classes: (string | boolean | undefined)[]): string {
  return cn(...classes);
}
