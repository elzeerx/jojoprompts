import { useSecurityMonitoring } from "@/hooks/useSecurityMonitoring";
import { createLogger } from "@/utils/logging";

interface SecurityMonitoringWrapperProps {
  children: React.ReactNode;
}

export function SecurityMonitoringWrapper({ children }: SecurityMonitoringWrapperProps) {
  const logger = createLogger('SECURITY_MONITOR');
  
  // Initialize security monitoring with error handling
  try {
    useSecurityMonitoring({
      enableRouteMonitoring: true,
      enableSessionValidation: false, // Disable for now
      enableRateLimit: false // Disable for now
    });
  } catch (error) {
    logger.warn('Security monitoring initialization failed', error);
  }

  return <>{children}</>;
}