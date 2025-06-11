
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Home, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const NotFoundPage = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-[calc(100vh-9rem)] bg-gradient-to-br from-soft-bg via-white to-soft-bg flex items-center justify-center mobile-container-padding">
      <div className="text-center max-w-md mx-auto">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-warm-gold/10 p-4">
            <FileText className="h-12 w-12 text-warm-gold" />
          </div>
        </div>
        
        <h1 className="text-6xl font-bold text-dark-base mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-dark-base mb-4">Page Not Found</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Oops! The page you're looking for doesn't exist. It might have been moved, deleted, or you entered the wrong URL.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="mobile-button-primary">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="mobile-button-secondary" onClick={() => window.history.back()}>
            <span>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </span>
          </Button>
        </div>
        
        <div className="mt-8 text-sm text-muted-foreground">
          <p>Need help? <Link to="/contact" className="text-warm-gold hover:underline">Contact our support team</Link></p>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
