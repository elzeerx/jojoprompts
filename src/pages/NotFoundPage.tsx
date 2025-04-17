
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, Home } from "lucide-react";

export default function NotFoundPage() {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-9rem)] p-4 text-center">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <FileText className="h-10 w-10 text-primary" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-2">404</h1>
      <p className="text-xl text-muted-foreground mb-6">
        Oops! The page you're looking for doesn't exist.
      </p>
      <p className="text-muted-foreground max-w-md mb-8">
        It seems the prompt you were searching for has vanished into the digital void.
        Let's get you back to exploring our collection of AI prompts.
      </p>
      <Button asChild>
        <Link to="/" className="flex items-center gap-2">
          <Home className="h-4 w-4" />
          Return Home
        </Link>
      </Button>
    </div>
  );
}
