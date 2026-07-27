import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const SUPABASE_PROJECT_REF = 'fxkqgjakbyrxkmevkglv';

// Strict token contract enforced client-side. Matches the server-side
// contract in supabase/functions/smart-unsubscribe/index.ts.
const isValidUnsubscribeToken = (t: string) => /^[A-Za-z0-9]{32,128}$/.test(t);

function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('');
  const [isSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token');

    if (token && isValidUnsubscribeToken(token)) {
      // Token-only handoff to the edge function, which renders its own
      // confirmation HTML. Never accept or forward a raw email.
      window.location.href = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/smart-unsubscribe?token=${encodeURIComponent(token)}`;
      return;
    }

    setIsLoading(false);
    setMessage('Invalid unsubscribe link. Please use the link from your most recent email.');
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-warm-gold mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-dark-base mb-2">Processing your request...</h2>
          <p className="text-gray-600">Please wait while we unsubscribe you from our emails.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <div className={`text-6xl mb-4 ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
          {isSuccess ? '✅' : '⚠️'}
        </div>
        <h2 className="text-2xl font-semibold text-dark-base mb-2">
          {isSuccess ? 'Successfully Unsubscribed' : 'Unsubscribe Failed'}
        </h2>
        <p className="text-gray-600 mb-4">{message}</p>
        <a
          href="/"
          className="inline-block px-6 py-3 min-h-[44px] bg-warm-gold text-white rounded-lg hover:bg-warm-gold/90 transition-colors"
        >
          Return to JojoPrompts
        </a>
      </div>
    </div>
  );
}

export default UnsubscribePage;
