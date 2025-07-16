import { AlertTriangle } from 'lucide-react';
import { isAppleEmail } from '@/utils/emailUtils';

interface AppleEmailNoticeProps {
  email: string;
}

export function AppleEmailNotice({ email }: AppleEmailNoticeProps) {
  if (!isAppleEmail(email)) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-500 w-5 h-5 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-amber-800 mb-2">
            Apple Email Users: Important Delivery Notice
          </h3>
          <p className="text-sm text-amber-700 leading-relaxed">
            To ensure you receive our emails, please add{' '}
            <code className="bg-amber-100 px-2 py-1 rounded text-amber-800 font-mono text-xs">
              noreply@noreply.jojoprompts.com
            </code>{' '}
            to your contacts in your Apple Mail app. This will help ensure our 
            confirmation emails and important notifications reach your inbox.
          </p>
          <div className="mt-3 text-xs text-amber-600">
            <p>
              <strong>Quick steps:</strong> Open Apple Mail → Contacts → Add New Contact → 
              Enter our email address → Save
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}