import * as React from "react";
import { cn } from "@/lib/utils";

interface FloatingElementProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Animation type */
  animation?: "float-slow" | "float-delayed" | "float-rotate" | "orbit" | "none";
  /** Animation delay in seconds */
  delay?: number;
  /** Animation duration multiplier */
  duration?: number;
  /** Z-index for layering */
  zIndex?: number;
  /** Initial rotation */
  rotate?: number;
}

const FloatingElement = React.forwardRef<HTMLDivElement, FloatingElementProps>(
  ({ 
    className, 
    animation = "float-slow", 
    delay = 0, 
    duration = 1,
    zIndex = 1,
    rotate = 0,
    children, 
    style,
    ...props 
  }, ref) => {
    const animationClass = animation !== "none" ? `animate-${animation}` : "";
    
    return (
      <div
        ref={ref}
        className={cn(
          "absolute will-animate gpu-accelerate",
          animationClass,
          className
        )}
        style={{
          animationDelay: `${delay}s`,
          animationDuration: animation === "orbit" ? `${20 * duration}s` : `${6 * duration}s`,
          zIndex,
          transform: rotate ? `rotate(${rotate}deg)` : undefined,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
FloatingElement.displayName = "FloatingElement";

// Predefined floating shapes
interface FloatingShapeProps extends Omit<FloatingElementProps, "children"> {
  shape: "circle" | "ring" | "dot" | "square" | "blob";
  size?: "sm" | "md" | "lg" | "xl";
  color?: "gold" | "teal" | "white" | "dark";
  opacity?: number;
  blur?: boolean;
}

const shapeStyles = {
  circle: "rounded-full",
  ring: "rounded-full border-2 bg-transparent",
  dot: "rounded-full",
  square: "rounded-lg",
  blob: "rounded-[40%_60%_60%_40%/60%_40%_60%_40%]",
};

const sizeStyles = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
};

const colorStyles = {
  gold: "bg-warm-gold border-warm-gold",
  teal: "bg-muted-teal border-muted-teal",
  white: "bg-white border-white",
  dark: "bg-dark-base border-dark-base",
};

const FloatingShape = React.forwardRef<HTMLDivElement, FloatingShapeProps>(
  ({ 
    shape = "circle", 
    size = "md", 
    color = "gold", 
    opacity = 0.2,
    blur = false,
    className,
    ...props 
  }, ref) => {
    return (
      <FloatingElement
        ref={ref}
        className={cn(
          shapeStyles[shape],
          sizeStyles[size],
          colorStyles[color],
          blur && "blur-xl",
          className
        )}
        style={{ opacity }}
        {...props}
      />
    );
  }
);
FloatingShape.displayName = "FloatingShape";

// Floating prompt preview card
interface FloatingCardProps extends FloatingElementProps {
  title?: string;
  preview?: string;
}

const FloatingCard = React.forwardRef<HTMLDivElement, FloatingCardProps>(
  ({ title, preview, className, ...props }, ref) => {
    return (
      <FloatingElement
        ref={ref}
        className={cn(
          "bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-xl border border-white/50",
          "max-w-[180px] sm:max-w-[220px]",
          className
        )}
        {...props}
      >
        {title && (
          <p className="text-xs font-semibold text-dark-base mb-1 truncate">{title}</p>
        )}
        {preview && (
          <p className="text-[10px] text-muted-foreground line-clamp-2">{preview}</p>
        )}
      </FloatingElement>
    );
  }
);
FloatingCard.displayName = "FloatingCard";

export { FloatingElement, FloatingShape, FloatingCard };
