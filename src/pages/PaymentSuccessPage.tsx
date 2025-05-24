
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function PaymentSuccessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to home if not authenticated
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);
  
  return (
    <div className="container max-w-lg mx-auto py-12">
      <Card className="border-green-100">
        <CardHeader className="text-center pb-2">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-2" />
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-lg">
            Thank you for your purchase. Your plan access is now active.
          </p>
          
          <div className="bg-green-50 p-4 rounded-md">
            <p className="font-medium">Your account has been successfully upgraded!</p>
            <p className="text-sm mt-2">You now have access to all the features included in your plan.</p>
          </div>
          
          <div className="border-t pt-4">
            <p>
              We've sent you a confirmation email with your receipt and access details.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button className="w-full" asChild>
            <Link to="/prompts">Browse Prompts</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/dashboard">View My Account</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
