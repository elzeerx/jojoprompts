
import { BarChart3, FileText, Tags, Users, CreditCard, Percent, Mail, ShoppingCart } from "lucide-react";

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
  { id: "abandoned-cart", label: "Abandoned Cart", icon: ShoppingCart, mobileLabel: "Recovery" },
  { id: "discounts", label: "Discounts", icon: Percent, mobileLabel: "Codes" },
  { id: "email-templates", label: "Email Templates", icon: Mail, mobileLabel: "Templates" },
  { id: "emails", label: "Email Analytics", icon: Mail, mobileLabel: "Emails" }
];
