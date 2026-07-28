import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The Radix Root is the actual clickable/focusable element, so we resize the
 * root itself (not a pseudo-element) to a 44x44 hit area on mobile while the
 * visible 16x16 tick square is rendered by an inner span. On md+ the root
 * collapses back to 16x16 to preserve compact admin table density.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer group relative inline-flex h-11 w-11 md:h-4 md:w-4 shrink-0 items-center justify-center rounded-sm bg-transparent ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
      className
    )}
    {...props}
  >
    <span
      aria-hidden="true"
      className="pointer-events-none flex h-4 w-4 items-center justify-center rounded-sm border border-primary bg-transparent text-current group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground"
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </span>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
