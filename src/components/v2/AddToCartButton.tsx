import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Check } from "lucide-react";
import { useCart, CART_MAX_ITEMS } from "@/hooks/v2/useCart";
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
    dupTitle: lang === "ar" ? "موجود بالفعل في السلة" : "Already in cart",
    capTitle: lang === "ar" ? "بلغت الحد الأقصى للسلة" : "Cart is full",
    capDesc:
      lang === "ar"
        ? `يمكن أن تحتوي السلة على ${CART_MAX_ITEMS} عناصر كحد أقصى.`
        : `Your cart can hold up to ${CART_MAX_ITEMS} items.`,
    invalid: lang === "ar" ? "تعذّر إضافة العنصر." : "Couldn't add this item.",
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
        const res = cart.add({
          product_id: productId,
          snapshot: {
            title_en: titleEn,
            title_ar: titleAr,
            resource_type: resourceType,
            product_type: productType,
          },
        });
        if (res.ok) {
          toast({ title: t.added });
          return;
        }
        if (res.reason === "cap_reached") {
          toast({ variant: "destructive", title: t.capTitle, description: t.capDesc });
        } else if (res.reason === "duplicate") {
          toast({ title: t.dupTitle });
        } else {
          toast({ variant: "destructive", title: t.invalid });
        }

      }}
    >
      <ShoppingBag className="h-4 w-4 me-1" aria-hidden />
      {t.add}
    </Button>
  );
}
