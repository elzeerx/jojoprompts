import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Check } from "lucide-react";
import { useCart } from "@/hooks/v2/useCart";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  productId: string;
  productType: "individual" | "bundle" | "lifetime" | "free";
  titleEn: string;
  titleAr: string | null;
  resourceType: string | null;
  size?: "sm" | "default";
  fullWidth?: boolean;
}

/**
 * Idempotent Add-to-cart button. Repeated taps do not duplicate:
 * once present in the cart the button flips to "View cart".
 */
export function AddToCartButton({
  productId,
  productType,
  titleEn,
  titleAr,
  resourceType,
  size = "sm",
  fullWidth,
}: Props) {
  const cart = useCart();
  const { language } = useTranslation();
  const lang = language === "ar" ? "ar" : "en";
  const inCart = cart.has(productId);

  const t = {
    add: lang === "ar" ? "أضف إلى السلة" : "Add to cart",
    view: lang === "ar" ? "عرض السلة" : "View cart",
    added: lang === "ar" ? "أُضيف إلى السلة" : "Added to cart",
  };

  if (inCart) {
    return (
      <Button
        asChild
        size={size}
        variant="outline"
        className={cn("min-h-[44px]", fullWidth && "w-full")}
      >
        <Link to="/cart">
          <Check className="h-4 w-4 me-1" aria-hidden />
          {t.view}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      size={size}
      className={cn("min-h-[44px]", fullWidth && "w-full")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        cart.add({
          product_id: productId,
          snapshot: {
            title_en: titleEn,
            title_ar: titleAr,
            resource_type: resourceType,
            product_type: productType,
          },
        });
        toast({ title: t.added });
      }}
    >
      <ShoppingBag className="h-4 w-4 me-1" aria-hidden />
      {t.add}
    </Button>
  );
}
