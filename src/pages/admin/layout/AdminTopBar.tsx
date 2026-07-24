import { useLocation, Link, useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { findAdminNavItem } from "../config/adminNavConfig";
import { ChevronRight, Command, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AdminTopBarProps {
  onOpenCommandPalette?: () => void;
}

// Resolve environment label from the running host — no secrets exposed.
function envLabel(): { text: string; tone: "prod" | "preview" | "dev" } {
  if (typeof window === "undefined") return { text: "server", tone: "dev" };
  const host = window.location.hostname;
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(host) || host.endsWith(".local")) {
    return { text: "Local", tone: "dev" };
  }
  if (host.includes("preview") || host.includes("lovable.app")) {
    return { text: "Preview", tone: "preview" };
  }
  return { text: "Production", tone: "prod" };
}

export function AdminTopBar({ onOpenCommandPalette }: AdminTopBarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = findAdminNavItem(pathname);
  const title = current?.label ?? "Admin";
  const { user, signOut } = useAuth();
  const env = envLabel();
  const initials = ((user?.email ?? "A").slice(0, 2)).toUpperCase();

  const envClass =
    env.tone === "prod"
      ? "bg-red-50 text-red-700 border-red-200"
      : env.tone === "preview"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-3 border-b border-gray-200 bg-white/90 backdrop-blur px-3 sm:px-5"
      aria-label="Admin top bar"
    >
      <SidebarTrigger className="text-muted-foreground hover:text-dark-base" />
      <div className="h-5 w-px bg-gray-200" />
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0 flex-1" aria-label="Breadcrumb">
        <Link to="/admin" className="hover:text-dark-base transition-colors">
          Admin
        </Link>
        {current && current.to !== "/admin" && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="text-dark-base font-medium truncate">{title}</span>
          </>
        )}
      </nav>

      <span
        className={`hidden sm:inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${envClass}`}
        aria-label={`Environment: ${env.text}`}
      >
        {env.text}
      </span>

      {onOpenCommandPalette && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenCommandPalette}
          className="h-9 gap-2 text-muted-foreground hidden sm:inline-flex min-h-[44px] sm:min-h-[36px]"
        >
          <Command className="h-3.5 w-3.5" aria-hidden />
          <span className="text-xs">Quick jump</span>
          <kbd className="ml-1 inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-mono">
            ⌘K
          </kbd>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full border border-gray-200 bg-white text-xs font-semibold text-dark-base"
            aria-label="Admin account menu"
          >
            {initials}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Signed in as
          </DropdownMenuLabel>
          <div className="px-2 pb-2 text-sm font-medium text-dark-base truncate" title={user?.email ?? undefined}>
            {user?.email ?? "Unknown"}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/profile")}>
            <UserIcon className="mr-2 h-4 w-4" aria-hidden /> Account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-700 focus:text-red-800"
            onSelect={async () => {
              try {
                await signOut();
              } finally {
                navigate("/login");
              }
            }}
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
