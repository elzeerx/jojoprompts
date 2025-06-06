
import { useRef, useEffect } from 'react';

declare global {
  interface Window {
    Tapjsli?: any;
  }
}

export function useTapScriptLoader() {
  const componentMountedRef = useRef(true);

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
    };
  }, []);

  const logTapEvent = (event: string, data?: any) => {
    console.log(`[Tap Script] ${event}:`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  };

  const loadTapScript = async (): Promise<void> => {
    if (window.Tapjsli) {
      logTapEvent('Script Already Loaded');
      return;
    }

    logTapEvent('Script Loading Started');
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://tap.company/js/pay.js';
      
      script.onload = () => {
        if (!componentMountedRef.current) return;
        logTapEvent('Script Loaded Successfully');
        resolve();
      };
      
      script.onerror = () => {
        if (!componentMountedRef.current) return;
        const errorMessage = 'Failed to load Tap payment system';
        logTapEvent('Script Load Error', { error: errorMessage });
        reject(new Error(errorMessage));
      };
      
      document.head.appendChild(script);
    });
  };

  return {
    loadTapScript,
    isComponentMounted: () => componentMountedRef.current,
    logTapEvent
  };
}
