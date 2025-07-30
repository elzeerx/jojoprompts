import { useSecurityMonitoring } from "@/hooks/useSecurityMonitoring";

interface SecurityMonitoringWrapperProps {
  children: React.ReactNode;
}

export function SecurityMonitoringWrapper({ children }: SecurityMonitoringWrapperProps) {
  // Initialize security monitoring - this runs inside AuthProvider
  useSecurityMonitoring({
    enableRouteMonitoring: true,
    enableSessionValidation: true,
    enableRateLimit: true
  });

  return <>{children}</>;
}