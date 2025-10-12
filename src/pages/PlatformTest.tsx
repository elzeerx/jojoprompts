/**
 * PlatformTest.tsx
 * 
 * Redirects to the new Demo Hub at /demos
 * This file is kept for backward compatibility
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@/components/ui/container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function PlatformTest() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to demos hub
    navigate('/demos', { replace: true });
  }, [navigate]);

  return (
    <Container className="py-12">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Redirecting to Demo Hub...</CardTitle>
            <CardDescription>
              The demo and test features have been reorganized into a new Demo Hub
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
