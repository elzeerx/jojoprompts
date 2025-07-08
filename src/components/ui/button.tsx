
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-lg touch-manipulation min-h-[44px]", // Added touch-manipulation and min-height for mobile
  {
    variants: {
      variant: {
        default: "bg-warm-gold text-white hover:bg-warm-gold/90 active:bg-warm-gold/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border border-warm-gold/30 bg-transparent hover:bg-warm-gold/10 text-dark-base active:bg-warm-gold/20",
        secondary:
          "bg-muted-teal text-white hover:bg-muted-teal/90 active:bg-muted-teal/80",
        ghost: "hover:bg-warm-gold/10 hover:text-warm-gold active:bg-warm-gold/20",
        link: "text-warm-gold underline-offset-4 hover:underline active:text-warm-gold/80",
      },
      size: {
        default: "h-10 px-4 py-2 min-h-[44px]", // Ensured min-height
        sm: "h-9 px-3 min-h-[36px]",
        lg: "h-11 px-8 min-h-[48px]", // Larger touch target for mobile
        icon: "h-10 w-10 min-h-[44px] min-w-[44px]", // Square touch target
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
