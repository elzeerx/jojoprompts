import { NavLink, Outlet } from "react-router-dom";
import { Mail, MailOpen, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const subNav = [
  { to: "/admin/emails/templates", label: "Templates", icon: Mail },
  { to: "/admin/emails/analytics", label: "Analytics", icon: MailOpen },
  { to: "/admin/emails/marketing", label: "Marketing", icon: Send },
];

export default function CommunicationsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-dark-base">
          Communications
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage email templates, monitor delivery, and run marketing campaigns.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
          {subNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap",
                    isActive
                      ? "border-warm-gold text-warm-gold font-medium"
                      : "border-transparent text-muted-foreground hover:text-dark-base hover:border-gray-300"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
