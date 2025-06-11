
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export default function FavoritesPage() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/pricing" replace />;
  }

  return (
    <div className="min-h-screen bg-soft-bg mobile-container-padding mobile-section-padding">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-warm-gold/10 p-3">
              <Heart className="h-8 w-8 text-warm-gold" />
            </div>
          </div>
          <h1 className="section-title mb-4 text-dark-base">Your Favorites</h1>
          <p className="section-subtitle">
            Save and organize your favorite AI prompts for quick access
          </p>
        </div>

        <Card className="border-2 border-dashed border-warm-gold/30 bg-warm-gold/5">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-dark-base">No Favorites Yet</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Start browsing our prompt collection and save your favorites for easy access later.
            </p>
            <Button asChild className="bg-warm-gold hover:bg-warm-gold/90">
              <Link to="/prompts" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Browse Prompts
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
