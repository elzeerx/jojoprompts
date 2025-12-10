// Hook for Zero-Trust Access Control Integration

import { useState, useEffect } from 'react';
import { ZeroTrustAccessController, AccessDecision, AccessContext } from '@/utils/access/zeroTrustAccess';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/utils/logging';

const logger = createLogger('ZERO_TRUST_ACCESS');

export function useZeroTrustAccess(
  resourceType: string,
  action: string = 'read',
  context: AccessContext = {}
) {
  const { user } = useAuth();
  const [decision, setDecision] = useState<AccessDecision | null>(null);
  const [loading, setLoading] = useState(false);

  const evaluateAccess = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const result = await ZeroTrustAccessController.evaluateAccess(
        user.id,
        resourceType,
        action,
        context
      );
      setDecision(result);
    } catch (error) {
      logger.error('Access evaluation failed', { error, userId: user.id, resourceType, action });
      setDecision({
        decision: 'deny',
        riskScore: 100,
        factors: { error: 'evaluation_failed' }
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    evaluateAccess();
  }, [user?.id, resourceType, action]);

  return {
    decision,
    loading,
    hasAccess: decision?.decision === 'allow',
    isConditional: decision?.decision === 'conditional',
    riskScore: decision?.riskScore || 0,
    requiredActions: decision?.requiredActions || [],
    reEvaluate: evaluateAccess
  };
}