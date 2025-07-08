
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, Home, Sparkles } from "lucide-react";

export default function NotFoundPage() {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-9rem)] mobile-container-padding relative">
      {/* Enhanced mobile background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 text-warm-gold/20 animate-pulse">
          <Sparkles className="h-6 w-6 sm:h-8 sm:w-8" />
        </div>
        <div className="absolute bottom-10 left-10 text-muted-teal/20 animate-pulse delay-1000">
          <Sparkles className="h-4 w-4 sm:h-6 sm:w-6" />
        </div>
        <div className="absolute top-1/4 left-1/4 text-warm-gold/10 animate-bounce delay-500">
          <Sparkles className="h-5 w-5 sm:h-7 sm:w-7" />
        </div>
      </div>

      <div className="text-center relative z-10 max-w-md mx-auto">
        <div className="rounded-full bg-warm-gold/10 p-4 sm:p-6 mb-6 mx-auto w-fit border-2 border-warm-gold/20">
          <FileText className="h-8 w-8 sm:h-12 sm:w-12 text-warm-gold" />
        </div>
        
        <h1 className="text-6xl sm:text-8xl font-bold tracking-tight mb-4 text-dark-base bg-gradient-to-r from-warm-gold to-muted-teal bg-clip-text text-transparent">
          404
        </h1>
        
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-dark-base">
          Page Not Found
        </h2>
        
        <p className="text-base sm:text-lg text-muted-foreground mb-6 leading-relaxed">
          Oops! The page you're looking for seems to have vanished into the digital void.
        </p>
        
        <p className="text-sm sm:text-base text-muted-foreground mb-8 px-4">
          It seems the prompt you were searching for has disappeared. 
          Let's get you back to exploring our collection of AI prompts.
        </p>
        
        <div className="space-y-3 sm:space-y-4">
          <Button asChild className="w-full sm:w-auto mobile-button-primary">
            <Link to="/" className="flex items-center justify-center gap-2">
              <Home className="h-4 w-4" />
              Return Home
            </Link>
          </Button>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button asChild variant="outline" className="mobile-button-secondary">
              <Link to="/prompts">Browse Prompts</Link>
            </Button>
            
            <Button asChild variant="outline" className="mobile-button-secondary">
              <Link to="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
