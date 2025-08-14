import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      // If there's a token, the smart-unsubscribe function will handle it
      // and return an HTML page directly, so we don't need to do anything here
      // This component is just a fallback
      window.location.href = `https://fxkqgjakbyrxkmevkglv.supabase.co/functions/v1/smart-unsubscribe?token=${token}`;
    } else {
      setIsLoading(false);
      setMessage('Invalid unsubscribe link');
      setIsSuccess(false);
    }
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
          className="inline-block px-6 py-3 bg-warm-gold text-white rounded-lg hover:bg-warm-gold/90 transition-colors"
        >
          Return to JojoPrompts
        </a>
      </div>
    </div>
  );
}

export default UnsubscribePage;