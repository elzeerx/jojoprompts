import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { adminNavGroups } from "../config/adminNavConfig";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const isActive = (to: string, end?: boolean) =>
    end ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon" className="border-r border-gray-200">
      <SidebarHeader className="border-b border-gray-200 px-4 py-4">
        {!collapsed ? (
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Admin
            </span>
            <span className="text-base font-semibold text-dark-base">
              JojoPrompts
            </span>
          </div>
        ) : (
          <div className="h-2 w-2 rounded-full bg-warm-gold mx-auto" />
        )}
      </SidebarHeader>

      <SidebarContent>
        {adminNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to, item.end);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild={!item.disabled}
                        isActive={active}
                        tooltip={item.label}
                        disabled={item.disabled}
                        className={cn(
                          "data-[active=true]:bg-warm-gold/10 data-[active=true]:text-warm-gold data-[active=true]:font-medium",
                          item.disabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {item.disabled ? (
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <span className="flex-1 truncate">{item.label}</span>
                            )}
                            {!collapsed && (
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                                Soon
                              </span>
                            )}
                          </div>
                        ) : (
                          <NavLink to={item.to} end={item.end}>
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </NavLink>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
