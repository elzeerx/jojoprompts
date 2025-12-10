import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, BarChart3 } from 'lucide-react';
import { AbandonedCartManagement } from './AbandonedCartManagement';
import { AbandonedCartAnalytics } from './AbandonedCartAnalytics';

export function AbandonedCartDashboard() {
  const [activeTab, setActiveTab] = useState('management');

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="management" className="gap-2">
            <Settings className="h-4 w-4" />
            Management
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="management" className="mt-6">
          <AbandonedCartManagement />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <AbandonedCartAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
