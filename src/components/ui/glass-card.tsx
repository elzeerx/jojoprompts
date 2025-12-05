import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassCardVariants = cva(
  "relative overflow-hidden transition-all duration-300 rounded-2xl",
  {
    variants: {
      variant: {
        // Frosted glass effect
        glass: [
          "bg-white/10 backdrop-blur-xl",
          "border border-white/20",
          "shadow-lg shadow-black/5",
        ].join(" "),
        
        // Dark glass
        "glass-dark": [
          "bg-dark-base/40 backdrop-blur-xl",
          "border border-white/10",
          "shadow-xl shadow-black/20",
        ].join(" "),
        
        // Elevated with multi-layer shadow
        elevated: [
          "bg-white",
          "border border-border/30",
          "shadow-[0_4px_20px_rgba(0,0,0,0.08),0_8px_40px_rgba(0,0,0,0.04)]",
          "hover:shadow-[0_8px_30px_rgba(0,0,0,0.12),0_16px_60px_rgba(0,0,0,0.08)]",
          "hover:-translate-y-1",
        ].join(" "),
        
        // Gradient border card
        gradient: [
          "bg-white",
          "before:absolute before:inset-0 before:rounded-2xl before:p-[1px]",
          "before:bg-gradient-to-br before:from-warm-gold/50 before:via-transparent before:to-muted-teal/50",
          "before:-z-10",
          "shadow-lg shadow-warm-gold/5",
        ].join(" "),
        
        // Interactive card with hover effects
        interactive: [
          "bg-white",
          "border border-border/20",
          "shadow-md",
          "hover:border-warm-gold/30",
          "hover:shadow-xl hover:shadow-warm-gold/10",
          "hover:-translate-y-2 hover:rotate-[0.5deg]",
          "cursor-pointer",
        ].join(" "),
        
        // Solid dark card
        solid: [
          "bg-dark-base",
          "text-white",
          "border border-white/10",
          "shadow-xl",
        ].join(" "),
      },
      padding: {
        none: "p-0",
        sm: "p-3 sm:p-4",
        default: "p-4 sm:p-6",
        lg: "p-6 sm:p-8",
      },
      glow: {
        true: "animate-border-glow",
        false: "",
      },
    },
    defaultVariants: {
      variant: "glass",
      padding: "default",
      glow: false,
    },
  }
);

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant, padding, glow, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(glassCardVariants({ variant, padding, glow, className }))}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

export { GlassCard, glassCardVariants };
