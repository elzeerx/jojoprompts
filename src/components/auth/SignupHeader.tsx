import { FileText, ShoppingBag } from "lucide-react";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

interface SignupHeaderProps {
  fromCheckout: boolean;
  selectedPlan: string | null;
}

export function SignupHeader({ fromCheckout, selectedPlan }: SignupHeaderProps) {
  const { t, isRTL } = useTranslation();
  
  return (
    <CardHeader className="space-y-2 px-4 sm:px-6 pt-6 pb-4">
      <div className="flex justify-center mb-2">
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          {(fromCheckout || selectedPlan) ? (
            <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" />
          ) : (
            <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
          )}
        </div>
      </div>
      <CardTitle className={cn(
        "text-xl sm:text-2xl font-bold text-center text-dark-base",
        isRTL && "rtl-text"
      )}>
        {t('auth.signupTitle')}
      </CardTitle>
      <CardDescription className={cn(
        "text-center text-sm sm:text-base",
        isRTL && "rtl-text"
      )}>
        {(fromCheckout || selectedPlan)
          ? t('auth.signupDescCheckout')
          : t('auth.signupDesc')}
      </CardDescription>
      
      {selectedPlan && (
        <div className={cn(
          "bg-green-50 border border-green-100 rounded-md p-3 mt-2",
          isRTL && "rtl-text text-right"
        )}>
          <p className="text-xs sm:text-sm text-green-800 text-center">
            {t('auth.confirmationRequired')}
          </p>
        </div>
      )}
      
      {fromCheckout && (
        <div className={cn(
          "bg-green-50 border border-green-100 rounded-md p-3 mt-2",
          isRTL && "rtl-text text-right"
        )}>
          <p className="text-xs sm:text-sm text-green-800 text-center">
            {t('auth.paymentSuccessful')}
          </p>
        </div>
      )}
    </CardHeader>
  );
}
