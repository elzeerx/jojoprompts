
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminTabConfig } from "../../config/adminTabsConfig";

interface DesktopTabsListProps {
  tabs: AdminTabConfig[];
}

export function DesktopTabsList({ tabs }: DesktopTabsListProps) {
  return (
    <div className="relative">
      {/* Scrollable container */}
      <div className="overflow-x-auto scrollbar-hide">
        <TabsList className="inline-flex w-max min-w-full bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg h-auto p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-warm-gold data-[state=active]:text-white data-[state=inactive]:hover:bg-gray-100 text-sm px-3 lg:px-4 py-2.5 flex items-center gap-2 shrink-0"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
      
      {/* Right fade indicator */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/80 to-transparent pointer-events-none rounded-r-lg" />
    </div>
  );
}
