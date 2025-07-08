
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminTabConfig } from "../../config/adminTabsConfig";

interface MobileTabsListProps {
  tabs: AdminTabConfig[];
  isSmallMobile: boolean;
}

export function MobileTabsList({ tabs, isSmallMobile }: MobileTabsListProps) {
  return (
    <div className="relative">
      <TabsList className="mobile-tabs w-full h-auto bg-white/80 backdrop-blur-sm border border-gray-200 p-1 grid grid-cols-3 sm:grid-cols-6 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="mobile-tab data-[state=active]:mobile-tab-active data-[state=inactive]:mobile-tab-inactive flex flex-col items-center gap-1 px-2 py-2 text-xs min-h-[60px]"
            >
              <Icon className="h-3 w-3" />
              <span className="leading-tight text-center">
                {isSmallMobile ? tab.mobileLabel : tab.label}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}
