import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Divider type */
  variant?: "wave" | "wave-reverse" | "angled" | "angled-reverse" | "curve" | "gradient";
  /** Top color (use CSS color or Tailwind class reference) */
  colorFrom?: string;
  /** Bottom color */
  colorTo?: string;
  /** Flip the divider */
  flip?: boolean;
  /** Height multiplier */
  height?: "sm" | "md" | "lg";
}

const heightClasses = {
  sm: "h-12 sm:h-16 md:h-20",
  md: "h-16 sm:h-24 md:h-32",
  lg: "h-24 sm:h-32 md:h-48",
};

const SectionDivider = React.forwardRef<HTMLDivElement, SectionDividerProps>(
  ({ 
    variant = "wave", 
    colorFrom = "#262626", 
    colorTo = "#efeee9",
    flip = false,
    height = "md",
    className,
    ...props 
  }, ref) => {
    const renderDivider = () => {
      switch (variant) {
        case "wave":
          return (
            <svg
              viewBox="0 0 1440 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={cn("w-full h-full", flip && "rotate-180")}
              preserveAspectRatio="none"
            >
              <path
                d="M0 120L48 110C96 100 192 80 288 70C384 60 480 60 576 65C672 70 768 80 864 85C960 90 1056 90 1152 85C1248 80 1344 70 1392 65L1440 60V120H1392C1344 120 1248 120 1152 120C1056 120 960 120 864 120C768 120 672 120 576 120C480 120 384 120 288 120C192 120 96 120 48 120H0Z"
                fill={colorTo}
              />
              <path
                d="M0 0V60L48 65C96 70 192 80 288 85C384 90 480 90 576 85C672 80 768 70 864 65C960 60 1056 60 1152 65C1248 70 1344 80 1392 85L1440 90V0H1392C1344 0 1248 0 1152 0C1056 0 960 0 864 0C768 0 672 0 576 0C480 0 384 0 288 0C192 0 96 0 48 0H0Z"
                fill={colorFrom}
              />
            </svg>
          );

        case "wave-reverse":
          return (
            <svg
              viewBox="0 0 1440 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={cn("w-full h-full", flip && "rotate-180")}
              preserveAspectRatio="none"
            >
              <path
                d="M0 0L60 10C120 20 240 40 360 50C480 60 600 60 720 55C840 50 960 40 1080 35C1200 30 1320 30 1380 30L1440 30V120H0V0Z"
                fill={colorFrom}
              />
              <path
                d="M0 60L60 55C120 50 240 40 360 35C480 30 600 30 720 35C840 40 960 50 1080 55C1200 60 1320 60 1380 60L1440 60V120H0V60Z"
                fill={colorTo}
              />
            </svg>
          );

        case "angled":
          return (
            <svg
              viewBox="0 0 1440 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={cn("w-full h-full", flip && "rotate-180")}
              preserveAspectRatio="none"
            >
              <polygon points="0,0 1440,100 0,100" fill={colorTo} />
              <polygon points="0,0 1440,0 1440,100" fill={colorFrom} />
            </svg>
          );

        case "angled-reverse":
          return (
            <svg
              viewBox="0 0 1440 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={cn("w-full h-full", flip && "rotate-180")}
              preserveAspectRatio="none"
            >
              <polygon points="0,100 1440,0 1440,100" fill={colorTo} />
              <polygon points="0,0 1440,0 0,100" fill={colorFrom} />
            </svg>
          );

        case "curve":
          return (
            <svg
              viewBox="0 0 1440 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={cn("w-full h-full", flip && "rotate-180")}
              preserveAspectRatio="none"
            >
              <path
                d="M0 100C240 100 480 0 720 0C960 0 1200 100 1440 100V100H0V100Z"
                fill={colorTo}
              />
              <path
                d="M0 0V100C240 100 480 0 720 0C960 0 1200 100 1440 100V0H0Z"
                fill={colorFrom}
              />
            </svg>
          );

        case "gradient":
          return (
            <div 
              className="w-full h-full"
              style={{
                background: `linear-gradient(to bottom, ${colorFrom}, ${colorTo})`,
              }}
            />
          );

        default:
          return null;
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative w-full overflow-hidden -my-px",
          heightClasses[height],
          className
        )}
        {...props}
      >
        {renderDivider()}
      </div>
    );
  }
);
SectionDivider.displayName = "SectionDivider";

export { SectionDivider };
