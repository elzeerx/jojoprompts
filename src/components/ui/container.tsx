
import * as React from "react"
import { cn } from "@/lib/utils"

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  noPadding?: boolean;
  mobileOptimized?: boolean;
}

export function Container({ 
  className, 
  size = 'xl', 
  noPadding = false,
  mobileOptimized = true,
  ...props 
}: ContainerProps) {
  const sizeClasses = {
    sm: "max-w-2xl",
    md: "max-w-4xl", 
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    full: "max-w-full"
  };

  return (
    <div
      className={cn(
        "mx-auto w-full",
        sizeClasses[size],
        !noPadding && (mobileOptimized ? "mobile-container-padding" : "px-4 sm:px-6 lg:px-8"),
        mobileOptimized && "mobile-optimize-rendering",
        className
      )}
      {...props}
    />
  )
}
