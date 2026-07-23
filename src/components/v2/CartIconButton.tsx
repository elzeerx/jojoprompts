import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/v2/useCart";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export function CartIconButton({ className }: { className?: string }) {
  const { count } = useCart();
  const { language } = useTranslation();
  const label = language === "ar" ? "السلة" : "Cart";
  return (
    <Link
      to="/cart"
      aria-label={`${label} (${count})`}
      className={cn(
        "relative inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-warm-gold min-h-[44px] min-w-[44px]",
        className,
      )}
    >
      <ShoppingBag className="h-5 w-5" aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute -top-0.5 -end-0.5 min-w-[20px] rounded-full bg-warm-gold px-1.5 text-[11px] font-bold leading-5 text-dark-base text-center"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
