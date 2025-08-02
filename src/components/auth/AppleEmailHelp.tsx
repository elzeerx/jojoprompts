import { HelpCircle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function AppleEmailHelp() {
  const handleInstructionsClick = () => {
    // Open Apple Mail instructions in a new tab
    window.open("https://support.apple.com/en-us/102322", "_blank");
  };

  return (
    <Alert className="border-blue-200 bg-blue-50">
      <HelpCircle className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-700">
        <div className="space-y-3">
          <p className="font-medium">Apple Mail users: Having trouble receiving emails?</p>
          <div className="text-sm space-y-1">
            <p>1. Check your Junk folder</p>
            <p>2. Mark our email as 'Not Junk'</p>
            <p>3. Add noreply@noreply.jojoprompts.com to your contacts</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstructionsClick}
            className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Detailed Instructions
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}