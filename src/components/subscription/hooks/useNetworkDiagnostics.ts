
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useNetworkDiagnostics() {
  const [isTestingConnectivity, setIsTestingConnectivity] = useState(false);
  const [connectivityStatus, setConnectivityStatus] = useState<{
    paypal: boolean | null;
    tap: boolean | null;
    lastChecked: Date | null;
  }>({
    paypal: null,
    tap: null,
    lastChecked: null
  });

  const testPayPalConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      console.log("Testing PayPal connectivity...");
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("PayPal connectivity test timeout")), 10000);
      });

      const testPromise = supabase.functions.invoke("get-paypal-config");
      
      const { data, error } = await Promise.race([testPromise, timeoutPromise]) as any;
      
      if (error) {
        console.error("PayPal connectivity test failed:", error);
        return false;
      }

      const isValid = data && data.clientId && data.environment;
      console.log("PayPal connectivity test result:", isValid);
      return isValid;
    } catch (error) {
      console.error("PayPal connectivity test error:", error);
      return false;
    }
  }, []);

  const testTapConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      console.log("Testing Tap connectivity...");
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Tap connectivity test timeout")), 10000);
      });

      const testPromise = supabase.functions.invoke("create-tap-session", {
        body: { amount: 1, planName: "Test", currency: "KWD" }
      });

      const { data, error } = await Promise.race([testPromise, timeoutPromise]) as any;
      
      if (error) {
        console.error("Tap connectivity test failed:", error);
        return false;
      }

      const isValid = data && data.publishableKey;
      console.log("Tap connectivity test result:", isValid);
      return isValid;
    } catch (error) {
      console.error("Tap connectivity test error:", error);
      return false;
    }
  }, []);

  const runConnectivityTests = useCallback(async () => {
    setIsTestingConnectivity(true);
    console.log("Running connectivity tests...");
    
    try {
      const [paypalResult, tapResult] = await Promise.all([
        testPayPalConnectivity(),
        testTapConnectivity()
      ]);

      const newStatus = {
        paypal: paypalResult,
        tap: tapResult,
        lastChecked: new Date()
      };

      setConnectivityStatus(newStatus);
      console.log("Connectivity test results:", newStatus);
      
      return newStatus;
    } catch (error) {
      console.error("Error running connectivity tests:", error);
      const errorStatus = {
        paypal: false,
        tap: false,
        lastChecked: new Date()
      };
      setConnectivityStatus(errorStatus);
      return errorStatus;
    } finally {
      setIsTestingConnectivity(false);
    }
  }, [testPayPalConnectivity, testTapConnectivity]);

  return {
    isTestingConnectivity,
    connectivityStatus,
    runConnectivityTests,
    testPayPalConnectivity,
    testTapConnectivity
  };
}
