
import { BarChart3, FileText, Tags, Users, CreditCard, Percent } from "lucide-react";

export interface AdminTabConfig {
  id: string;
  label: string;
  icon: any;
  mobileLabel: string;
}

export const adminTabsConfig: AdminTabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    icon: BarChart3,
    mobileLabel: "Overview"
  },
  {
    id: "prompts",
    label: "Prompts",
    icon: FileText,
    mobileLabel: "Prompts"
  },
  {
    id: "categories",
    label: "Categories",
    icon: Tags,
    mobileLabel: "Categories"
  },
  {
    id: "users",
    label: "Users",
    icon: Users,
    mobileLabel: "Users"
  },
  {
    id: "purchases",
    label: "Purchases",
    icon: CreditCard,
    mobileLabel: "Purchases"
  },
  {
    id: "discounts",
    label: "Discount Codes",
    icon: Percent,
    mobileLabel: "Discounts"
  }
];
