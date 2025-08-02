import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isAppleEmail } from '@/utils/emailUtils';

interface AppleEmailNoticeProps {
  email: string;
}

export function AppleEmailNotice({ email }: AppleEmailNoticeProps) {
  if (!isAppleEmail(email)) {
    return null;
  }

  return (
    <Alert className="border-amber-200 bg-amber-50">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-700">
        <div className="space-y-2">
          <p className="font-medium">Important for Apple Mail users:</p>
          <p className="text-sm">
            We've sent a confirmation email to <strong>{email}</strong>. 
            Please check your <strong>Junk/Spam folder</strong> and mark our email as 
            <strong> 'Not Junk'</strong> to ensure future emails reach your inbox.
          </p>
          <p className="text-sm">
            You may also want to add <strong>noreply@noreply.jojoprompts.com</strong> to your contacts.
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}