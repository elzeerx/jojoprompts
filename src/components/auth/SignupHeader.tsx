
import { FileText, ShoppingBag } from "lucide-react";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SignupHeaderProps {
  fromCheckout: boolean;
  selectedPlan: string | null;
}

export function SignupHeader({ fromCheckout, selectedPlan }: SignupHeaderProps) {
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
      <CardTitle className="text-xl sm:text-2xl font-bold text-center text-dark-base">
        Sign Up
      </CardTitle>
      <CardDescription className="text-center text-sm sm:text-base">
        {(fromCheckout || selectedPlan)
          ? "Create an account to complete your subscription" 
          : "Create an account to browse and save prompts"}
      </CardDescription>
      
      {selectedPlan && (
        <div className="bg-green-50 border border-green-100 rounded-md p-3 mt-2">
          <p className="text-xs sm:text-sm text-green-800 text-center">
            After creating your account, you'll receive a confirmation email. Click the link to proceed directly to checkout!
          </p>
        </div>
      )}
      
      {fromCheckout && (
        <div className="bg-green-50 border border-green-100 rounded-md p-3 mt-2">
          <p className="text-xs sm:text-sm text-green-800 text-center">
            Your payment was successful! Create an account to activate your subscription.
          </p>
        </div>
      )}
    </CardHeader>
  );
}
