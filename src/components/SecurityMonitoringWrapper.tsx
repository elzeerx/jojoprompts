import { useSecurityMonitoring } from "@/hooks/useSecurityMonitoring";

interface SecurityMonitoringWrapperProps {
  children: React.ReactNode;
}

export function SecurityMonitoringWrapper({ children }: SecurityMonitoringWrapperProps) {
  // Initialize security monitoring with error handling
  try {
    useSecurityMonitoring({
      enableRouteMonitoring: true,
      enableSessionValidation: false, // Disable for now
      enableRateLimit: false // Disable for now
    });
  } catch (error) {
    console.warn('Security monitoring initialization failed:', error);
  }

  return <>{children}</>;
}