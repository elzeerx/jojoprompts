import * as React from "react";
import { cn } from "@/lib/utils";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface ScrollRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Animation direction */
  direction?: "up" | "down" | "left" | "right" | "scale" | "fade";
  /** Animation delay in ms */
  delay?: number;
  /** Animation duration in ms */
  duration?: number;
  /** Distance to travel */
  distance?: number;
  /** Only animate once */
  once?: boolean;
  /** Threshold for triggering (0-1) */
  threshold?: number;
}

const ScrollReveal = React.forwardRef<HTMLDivElement, ScrollRevealProps>(
  ({ 
    direction = "up",
    delay = 0,
    duration = 600,
    distance = 40,
    once = true,
    threshold = 0.1,
    className,
    children,
    style,
    ...props 
  }, ref) => {
    const { ref: scrollRef, isVisible } = useScrollAnimation({
      threshold,
      triggerOnce: once,
      delay,
    });

    const getInitialTransform = () => {
      switch (direction) {
        case "up": return `translateY(${distance}px)`;
        case "down": return `translateY(-${distance}px)`;
        case "left": return `translateX(${distance}px)`;
        case "right": return `translateX(-${distance}px)`;
        case "scale": return "scale(0.9)";
        case "fade": return "none";
        default: return `translateY(${distance}px)`;
      }
    };

    return (
      <div
        ref={(node) => {
          // Handle both refs
          (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={cn("transition-all will-change-transform", className)}
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "none" : getInitialTransform(),
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          transitionDelay: `${delay}ms`,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ScrollReveal.displayName = "ScrollReveal";

// Staggered reveal for multiple children
interface StaggerRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stagger delay between items in ms */
  staggerDelay?: number;
  /** Base animation props */
  direction?: "up" | "down" | "left" | "right" | "scale" | "fade";
  duration?: number;
  distance?: number;
  threshold?: number;
}

const StaggerReveal = React.forwardRef<HTMLDivElement, StaggerRevealProps>(
  ({ 
    staggerDelay = 100,
    direction = "up",
    duration = 600,
    distance = 30,
    threshold = 0.1,
    className,
    children,
    ...props 
  }, ref) => {
    const { ref: containerRef, isVisible } = useScrollAnimation({
      threshold,
      triggerOnce: true,
    });

    const childArray = React.Children.toArray(children);

    const getInitialTransform = () => {
      switch (direction) {
        case "up": return `translateY(${distance}px)`;
        case "down": return `translateY(-${distance}px)`;
        case "left": return `translateX(${distance}px)`;
        case "right": return `translateX(-${distance}px)`;
        case "scale": return "scale(0.9)";
        case "fade": return "none";
        default: return `translateY(${distance}px)`;
      }
    };

    return (
      <div
        ref={(node) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={cn(className)}
        {...props}
      >
        {childArray.map((child, index) => (
          <div
            key={index}
            className="transition-all will-change-transform"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "none" : getInitialTransform(),
              transitionDuration: `${duration}ms`,
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              transitionDelay: isVisible ? `${index * staggerDelay}ms` : "0ms",
            }}
          >
            {child}
          </div>
        ))}
      </div>
    );
  }
);
StaggerReveal.displayName = "StaggerReveal";

export { ScrollReveal, StaggerReveal };
