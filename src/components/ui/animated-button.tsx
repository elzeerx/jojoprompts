import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const animatedButtonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-xl touch-manipulation min-h-[44px] overflow-hidden",
  {
    variants: {
      variant: {
        // Gradient button with glow
        gradient: [
          "bg-gradient-to-r from-warm-gold via-warm-gold/90 to-warm-gold",
          "text-white font-semibold",
          "shadow-lg shadow-warm-gold/25",
          "hover:shadow-xl hover:shadow-warm-gold/30",
          "hover:scale-[1.02] active:scale-[0.98]",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
          "before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700",
        ].join(" "),
        
        // Glass morphism button
        glass: [
          "bg-white/10 backdrop-blur-md",
          "border border-white/20",
          "text-white",
          "hover:bg-white/20 hover:border-white/30",
          "hover:scale-[1.02] active:scale-[0.98]",
          "shadow-lg shadow-black/5",
        ].join(" "),
        
        // Ghost with underline reveal
        ghost: [
          "bg-transparent",
          "text-foreground",
          "hover:text-warm-gold",
          "after:absolute after:bottom-2 after:left-1/2 after:-translate-x-1/2",
          "after:h-0.5 after:w-0 after:bg-warm-gold",
          "after:transition-all after:duration-300",
          "hover:after:w-3/4",
        ].join(" "),
        
        // Outlined with border animation
        outline: [
          "bg-transparent",
          "border-2 border-warm-gold/50",
          "text-warm-gold",
          "hover:border-warm-gold hover:bg-warm-gold/10",
          "hover:scale-[1.02] active:scale-[0.98]",
        ].join(" "),
        
        // Dark solid button
        dark: [
          "bg-dark-base",
          "text-white",
          "shadow-lg shadow-dark-base/25",
          "hover:bg-dark-base/90 hover:shadow-xl",
          "hover:scale-[1.02] active:scale-[0.98]",
        ].join(" "),
        
        // Secondary teal
        secondary: [
          "bg-muted-teal",
          "text-white font-medium",
          "shadow-md shadow-muted-teal/20",
          "hover:bg-muted-teal/90 hover:shadow-lg",
          "hover:scale-[1.02] active:scale-[0.98]",
        ].join(" "),
      },
      size: {
        sm: "h-9 px-4 text-sm min-h-[36px]",
        default: "h-11 px-6 text-base min-h-[44px]",
        lg: "h-14 px-8 text-lg min-h-[56px]",
        xl: "h-16 px-10 text-xl min-h-[64px]",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px] p-0",
      },
      glow: {
        true: "animate-glow-pulse",
        false: "",
      },
    },
    defaultVariants: {
      variant: "gradient",
      size: "default",
      glow: false,
    },
  }
);

export interface AnimatedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof animatedButtonVariants> {
  asChild?: boolean;
}

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ className, variant, size, glow, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    return (
      <Comp
        className={cn(animatedButtonVariants({ variant, size, glow, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
AnimatedButton.displayName = "AnimatedButton";

export { AnimatedButton, animatedButtonVariants };
