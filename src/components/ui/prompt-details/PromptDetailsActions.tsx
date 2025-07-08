
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle, Workflow } from "lucide-react";

interface PromptDetailsActionsProps {
  isN8nWorkflow: boolean;
  copied: boolean;
  onCopyPrompt: () => void;
}

export function PromptDetailsActions({
  isN8nWorkflow,
  copied,
  onCopyPrompt
}: PromptDetailsActionsProps) {
  return (
    <div className="pt-6">
      <Button
        onClick={onCopyPrompt}
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
            {isN8nWorkflow ? (
              <>
                <Workflow className="mr-2 h-5 w-5" />
                Copy Workflow
              </>
            ) : (
              <>
                <Copy className="mr-2 h-5 w-5" />
                Copy Prompt
              </>
            )}
          </>
        )}
      </Button>
    </div>
  );
}
