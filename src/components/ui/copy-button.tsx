import React from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/hooks/ui/useCopyToClipboard";

interface CopyButtonProps {
  value: string;
  className?: string;
}

export function CopyButton({ value, className }: CopyButtonProps) {
  const { copyToClipboard, hasCopied } = useCopyToClipboard({
    successDescription: "Content copied to clipboard",
    resetDelay: 1000
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(value);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={cn("transition-all rounded-lg", className)}
    >
      {hasCopied ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </>
      )}
    </Button>
  );
}