
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminTabConfig } from "../../config/adminTabsConfig";

interface DesktopTabsListProps {
  tabs: AdminTabConfig[];
}

export function DesktopTabsList({ tabs }: DesktopTabsListProps) {
  return (
    <TabsList className="w-full justify-start bg-white/80 backdrop-blur-sm border border-gray-200 h-auto p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="data-[state=active]:bg-warm-gold data-[state=active]:text-white data-[state=inactive]:hover:bg-gray-100 text-sm px-4 py-3 flex items-center gap-2"
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
