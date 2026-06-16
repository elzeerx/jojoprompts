import React from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/hooks/ui/useCopyToClipboard";

interface CopyButtonProps {
  value: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
  copiedLabel?: string;
  showLabel?: boolean;
  successDescription?: string;
  disabled?: boolean;
}

/**
 * Reusable copy-to-clipboard button.
 * - Toast feedback on copy / failure (via useCopyToClipboard)
 * - Clear "copied" visual state: icon swap + green tint + label change
 */
export function CopyButton({
  value,
  className,
  variant = "outline",
  size = "sm",
  label = "Copy",
  copiedLabel = "Copied",
  showLabel = true,
  successDescription = "Prompt copied to clipboard",
  disabled,
}: CopyButtonProps) {
  const { copyToClipboard, hasCopied } = useCopyToClipboard({
    successDescription,
    resetDelay: 1500,
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    copyToClipboard(value);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || !value}
      aria-live="polite"
      aria-label={hasCopied ? copiedLabel : label}
      className={cn(
        "transition-all rounded-lg gap-1.5 touch-manipulation",
        hasCopied &&
          "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400",
        className
      )}
    >
      {hasCopied ? (
        <Check className={cn("h-4 w-4", size === "sm" && "h-3.5 w-3.5")} />
      ) : (
        <Copy className={cn("h-4 w-4", size === "sm" && "h-3.5 w-3.5")} />
      )}
      {showLabel && <span>{hasCopied ? copiedLabel : label}</span>}
    </Button>
  );
}
