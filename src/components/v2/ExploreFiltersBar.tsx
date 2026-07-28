import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { V2_PLATFORMS, V2_COPY, type V2Platform } from "@/config/v2Flags";
import type { ExploreFilters } from "@/hooks/v2/useExploreResources";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  filters: ExploreFilters;
  onChange: (patch: Partial<ExploreFilters>) => void;
  onReset: () => void;
}

export function ExploreFiltersBar({ filters, onChange, onReset }: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const { language } = useTranslation();
  const lang = (language as "en" | "ar") ?? "en";

  const togglePlatform = (p: V2Platform) => {
    const cur = new Set(filters.platforms ?? []);
    if (cur.has(p)) {
      cur.delete(p);
    } else {
      cur.add(p);
    }
    onChange({ platforms: Array.from(cur) });
  };

  const activeCount =
    (filters.platforms?.length ?? 0) +
    (filters.priceMode && filters.priceMode !== "all" ? 1 : 0) +
    (filters.effort && filters.effort !== "all" ? 1 : 0);

  const controls = (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {V2_COPY.filters.price[lang]}
        </label>
        <Select
          value={filters.priceMode ?? "all"}
          onValueChange={(v) => onChange({ priceMode: v as ExploreFilters["priceMode"] })}
        >
          <SelectTrigger className="w-full min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{V2_COPY.filters.priceAll[lang]}</SelectItem>
            <SelectItem value="free">{V2_COPY.filters.priceFree[lang]}</SelectItem>
            <SelectItem value="paid">{V2_COPY.filters.pricePaid[lang]}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {V2_COPY.filters.effort[lang]}
        </label>
        <Select
          value={filters.effort ?? "all"}
          onValueChange={(v) => onChange({ effort: v as ExploreFilters["effort"] })}
        >
          <SelectTrigger className="w-full min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{V2_COPY.filters.effortAll[lang]}</SelectItem>
            <SelectItem value="quick">{V2_COPY.filters.effortQuick[lang]}</SelectItem>
            <SelectItem value="standard">{V2_COPY.filters.effortStandard[lang]}</SelectItem>
            <SelectItem value="advanced">{V2_COPY.filters.effortAdvanced[lang]}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {V2_COPY.filters.sort[lang]}
        </label>
        <Select
          value={filters.sortBy ?? "newest"}
          onValueChange={(v) => onChange({ sortBy: v as ExploreFilters["sortBy"] })}
        >
          <SelectTrigger className="w-full min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{V2_COPY.filters.sortNewest[lang]}</SelectItem>
            <SelectItem value="updated">{V2_COPY.filters.sortUpdated[lang]}</SelectItem>
            <SelectItem value="price_asc">{V2_COPY.filters.sortPriceAsc[lang]}</SelectItem>
            <SelectItem value="price_desc">{V2_COPY.filters.sortPriceDesc[lang]}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground">
          {V2_COPY.filters.platform[lang]}
        </label>
        <div className="flex flex-wrap gap-1.5" role="group">
          {V2_PLATFORMS.map((p) => {
            const active = (filters.platforms ?? []).includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                aria-pressed={active}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-gold rounded-full min-h-[44px]"
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
    </div>
  );

  return (
    <div className="sticky top-[8rem] lg:top-[8.5rem] z-20 w-full max-w-full overflow-x-hidden space-y-3 border-b border-border/40 bg-background/95 py-3 backdrop-blur">
      {/* Wrapper is width-bounded to its container to prevent horizontal
          document overflow at 390px. Any internal horizontal scrolling must
          stay inside its own child, not the sticky wrapper. */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder={V2_COPY.filters.searchPlaceholder[lang]}
            className="ps-9 min-h-[44px] w-full"
            value={filters.search ?? ""}
            onChange={(e) => onChange({ search: e.target.value })}
            aria-label={V2_COPY.filters.searchPlaceholder[lang]}
          />
        </div>
        {/* Desktop inline controls */}
        <div className="hidden md:flex md:items-center md:gap-2">
          <Select
            value={filters.sortBy ?? "newest"}
            onValueChange={(v) => onChange({ sortBy: v as ExploreFilters["sortBy"] })}
          >
            <SelectTrigger className="min-h-[44px] w-[180px]" aria-label={V2_COPY.filters.sort[lang]}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{V2_COPY.filters.sortNewest[lang]}</SelectItem>
              <SelectItem value="updated">{V2_COPY.filters.sortUpdated[lang]}</SelectItem>
              <SelectItem value="price_asc">{V2_COPY.filters.sortPriceAsc[lang]}</SelectItem>
              <SelectItem value="price_desc">{V2_COPY.filters.sortPriceDesc[lang]}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.priceMode ?? "all"}
            onValueChange={(v) => onChange({ priceMode: v as ExploreFilters["priceMode"] })}
          >
            <SelectTrigger className="min-h-[44px] w-[150px]" aria-label={V2_COPY.filters.price[lang]}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{V2_COPY.filters.priceAll[lang]}</SelectItem>
              <SelectItem value="free">{V2_COPY.filters.priceFree[lang]}</SelectItem>
              <SelectItem value="paid">{V2_COPY.filters.pricePaid[lang]}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.effort ?? "all"}
            onValueChange={(v) => onChange({ effort: v as ExploreFilters["effort"] })}
          >
            <SelectTrigger className="min-h-[44px] w-[170px]" aria-label={V2_COPY.filters.effort[lang]}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{V2_COPY.filters.effortAll[lang]}</SelectItem>
              <SelectItem value="quick">{V2_COPY.filters.effortQuick[lang]}</SelectItem>
              <SelectItem value="standard">{V2_COPY.filters.effortStandard[lang]}</SelectItem>
              <SelectItem value="advanced">{V2_COPY.filters.effortAdvanced[lang]}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Mobile Filters trigger + desktop Platform trigger */}
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="min-h-[44px] gap-2 md:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {V2_COPY.filters.filters[lang]}
          {activeCount > 0 ? (
            <Badge className="ms-1 h-5 min-w-5 px-1.5">{activeCount}</Badge>
          ) : null}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="hidden min-h-[44px] gap-2 md:inline-flex"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {V2_COPY.filters.platform[lang]}
          {(filters.platforms?.length ?? 0) > 0 ? (
            <Badge className="ms-1 h-5 min-w-5 px-1.5">{filters.platforms!.length}</Badge>
          ) : null}
        </Button>
      </div>


      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="px-4 pb-6">
            <div className="mx-auto w-full max-w-lg">
              <div className="mb-3 mt-2 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {V2_COPY.filters.filters[lang]}
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-md p-2 hover:bg-muted min-h-[44px] min-w-[44px]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {controls}
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    onReset();
                  }}
                  className="flex-1 min-h-[44px]"
                >
                  {V2_COPY.filters.reset[lang]}
                </Button>
                <Button
                  onClick={() => setOpen(false)}
                  className="flex-1 min-h-[44px]"
                >
                  {V2_COPY.filters.apply[lang]}
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-[380px] sm:max-w-md overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold">
              {V2_COPY.filters.filters[lang]}
            </h3>
            {controls}
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={onReset}
                className="flex-1 min-h-[44px]"
              >
                {V2_COPY.filters.reset[lang]}
              </Button>
              <Button
                onClick={() => setOpen(false)}
                className="flex-1 min-h-[44px]"
              >
                {V2_COPY.filters.apply[lang]}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
