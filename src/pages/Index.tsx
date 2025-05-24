
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HomePage from "./HomePage";

export default function Index() {
  const { loading, user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && userRole) {
      // Redirect users based on their role
      if (userRole === 'admin' || userRole === 'jadmin') {
        navigate('/admin');
      } else if (userRole === 'prompter') {
        navigate('/prompter');
      }
      // Regular users stay on the home page
    }
  }, [loading, user, userRole, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <HomePage />;
}
