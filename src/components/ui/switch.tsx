import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * The Radix Switch Root is the tappable element. On mobile we grow the root
 * itself to 44x44 (rather than relying on a decorative pseudo-element) while
 * the visible pill (24x44) is rendered by an inner span. On md+ the root
 * collapses back to the original 24x44 pill so admin density is unchanged.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer group inline-flex h-11 md:h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
      className
    )}
    {...props}
    ref={ref}
  >
    <span
      aria-hidden="true"
      className="pointer-events-none inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors group-data-[state=checked]:bg-primary group-data-[state=unchecked]:bg-input"
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </span>
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
