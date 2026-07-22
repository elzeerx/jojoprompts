import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { V2_PLATFORMS, type V2Platform } from "@/config/v2Flags";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import type { ExploreFilters } from "@/hooks/v2/useExploreResources";

interface Props {
  filters: ExploreFilters;
  onChange: (patch: Partial<ExploreFilters>) => void;
}

export function ExploreFiltersBar({ filters, onChange }: Props) {
  const togglePlatform = (p: V2Platform) => {
    const cur = new Set(filters.platforms ?? []);
    cur.has(p) ? cur.delete(p) : cur.add(p);
    onChange({ platforms: Array.from(cur) });
  };
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search prompts, skills, automations, styles, bundles…"
          className="ps-9 min-h-[44px]"
          value={filters.search ?? ""}
          onChange={(e) => onChange({ search: e.target.value })}
          aria-label="Search resources"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.priceMode ?? "all"}
          onValueChange={(v) => onChange({ priceMode: v as any })}
        >
          <SelectTrigger className="w-[140px] min-h-[44px]"><SelectValue placeholder="Price" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All prices</SelectItem>
            <SelectItem value="free">Free only</SelectItem>
            <SelectItem value="paid">Paid only</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.sortBy ?? "newest"}
          onValueChange={(v) => onChange({ sortBy: v as any })}
        >
          <SelectTrigger className="w-[160px] min-h-[44px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="price_asc">Price: low to high</SelectItem>
            <SelectItem value="price_desc">Price: high to low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by platform">
        {V2_PLATFORMS.map((p) => {
          const active = (filters.platforms ?? []).includes(p);
          return (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              aria-pressed={active}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-gold rounded-full"
            >
              <Badge
                variant={active ? "default" : "outline"}
                className="cursor-pointer capitalize min-h-[32px] px-3"
              >
                {p}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
