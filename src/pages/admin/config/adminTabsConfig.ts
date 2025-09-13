
import { BarChart3, FileText, Tags, Users, CreditCard, Percent, Mail, Activity, Settings, Search, Download } from "lucide-react";

export interface AdminTabConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  mobileLabel: string;
}

export const adminTabs: AdminTabConfig[] = [
  { id: "overview", label: "Overview", icon: BarChart3, mobileLabel: "Home" },
  { id: "prompts", label: "Prompts", icon: FileText, mobileLabel: "Prompts" },
  { id: "categories", label: "Categories", icon: Tags, mobileLabel: "Tags" },
  { id: "users", label: "Users", icon: Users, mobileLabel: "Users" },
  { id: "user-analytics", label: "User Analytics", icon: BarChart3, mobileLabel: "Analytics" },
  { id: "advanced-search", label: "Advanced Search", icon: Search, mobileLabel: "Search" },
  { id: "batch-ops", label: "Batch Operations", icon: Download, mobileLabel: "Batch" },
  { id: "automation", label: "Automation", icon: Settings, mobileLabel: "Auto" },
  { id: "admin-activity", label: "Admin Activity", icon: Activity, mobileLabel: "Activity" },
  { id: "purchases", label: "Purchases", icon: CreditCard, mobileLabel: "Sales" },
  { id: "discounts", label: "Discounts", icon: Percent, mobileLabel: "Codes" },
  { id: "email-templates", label: "Email Templates", icon: Mail, mobileLabel: "Templates" },
  { id: "emails", label: "Email Analytics", icon: Mail, mobileLabel: "Emails" }
];
