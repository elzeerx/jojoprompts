
import { useState } from "react";
import { adminTabs, AdminTabConfig } from "../config/adminTabsConfig";

export function useAdminTabs() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  return {
    adminTabs,
    activeTab,
    setActiveTab
  };
}
