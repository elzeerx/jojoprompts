
import { useState } from "react";
import { adminTabsConfig } from "../config/adminTabsConfig";

export function useAdminTabs() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  return {
    adminTabs: adminTabsConfig,
    activeTab,
    setActiveTab
  };
}
