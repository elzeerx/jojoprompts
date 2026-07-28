/* eslint-disable react-refresh/only-export-components -- command parsing is a pure exported contract used by route tests. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { adminNavGroups } from "../config/adminNavConfig";
import { RefreshCw } from "lucide-react";

interface AdminCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
  const navigate = useNavigate();

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a section, action, or page..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {adminNavGroups.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items
              .filter((i) => !i.disabled)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.to}
                    value={`${group.label} ${item.label}`}
                    onSelect={() => go(item.to)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {item.to}
                    </span>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="reload refresh"
            onSelect={() => {
              onOpenChange(false);
              window.location.reload();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Reload dashboard</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Hook that toggles the palette on ⌘K / Ctrl+K. */
export function useAdminCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen };
}
