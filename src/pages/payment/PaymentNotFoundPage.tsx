
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CreditCard } from "lucide-react";

export default function PaymentNotFoundPage() {
  return (
    <div className="mobile-container-padding mobile-section-padding relative">
      <div className="max-w-lg mx-auto relative z-10">
        <Card className="border-2 border-yellow-200 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-4 bg-gradient-to-r from-yellow-50 to-yellow-100/5">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <CreditCard className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-yellow-500" />
                <div className="absolute -top-1 -right-1 text-yellow-600">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-dark-base">Payment Page Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4 sm:space-y-6 p-6">
            <p className="text-base sm:text-lg text-muted-foreground">
              The payment page you're looking for doesn't exist.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-800 text-sm sm:text-base">Invalid Payment URL</p>
                  <p className="text-xs sm:text-sm mt-1 text-yellow-700">
                    This payment URL may be outdated or incorrect.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4 sm:pt-6">
              <p className="text-sm sm:text-base text-muted-foreground">
                If you were in the middle of a payment process, please try again from the beginning.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 p-6 pt-0">
            <Button className="w-full mobile-button-primary" asChild>
              <Link to="/pricing">View Plans</Link>
            </Button>
            <Button variant="outline" className="w-full mobile-button-secondary" asChild>
              <Link to="/">Return Home</Link>
            </Button>
            <Button variant="ghost" className="w-full" asChild>
              <Link to="/contact">Contact Support</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
