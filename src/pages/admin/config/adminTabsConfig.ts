
import { BarChart3, FileText, Tags, Users, CreditCard, Percent, Mail } from "lucide-react";

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
  { id: "purchases", label: "Purchases", icon: CreditCard, mobileLabel: "Sales" },
  { id: "discounts", label: "Discounts", icon: Percent, mobileLabel: "Codes" },
  { id: "emails", label: "Email Analytics", icon: Mail, mobileLabel: "Emails" }
];
