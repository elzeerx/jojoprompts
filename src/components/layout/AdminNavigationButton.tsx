
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export function AdminNavigationButton() {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  // Only show for admin users
  if (userRole !== 'admin') {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate('/admin')}
      className="text-warm-gold hover:text-warm-gold/80 hover:bg-warm-gold/10"
    >
      <Shield className="h-4 w-4 mr-2" />
      Admin
    </Button>
  );
}
