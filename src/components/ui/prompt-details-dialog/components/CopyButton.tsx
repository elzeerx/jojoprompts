
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle } from "lucide-react";

interface CopyButtonProps {
  copied: boolean;
  onCopy: () => void;
}

export function CopyButton({ copied, onCopy }: CopyButtonProps) {
  return (
    <div className="pt-6">
      <Button
        onClick={onCopy}
        className="w-full bg-[#c49d68] hover:bg-[#c49d68]/90 text-white font-semibold py-3 text-base rounded-xl shadow-md transition-all duration-200"
        disabled={copied}
      >
        {copied ? (
          <>
            <CheckCircle className="mr-2 h-5 w-5" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="mr-2 h-5 w-5" />
            Copy Prompt
          </>
        )}
      </Button>
    </div>
  );
}
