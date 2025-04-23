
import { Link, useLocation } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function FloatingAddPromptButton() {
  const { user } = useAuth();
  const location = useLocation();

  // Hide on add prompt page
  if (!user || location.pathname === "/prompts/new") return null;

  return (
    <Link
      to="/prompts/new"
      className="fixed z-50 bottom-8 right-8 md:bottom-10 md:right-10 hover:scale-105 transition-transform"
      aria-label="Add Prompt"
      title="Add Prompt"
      style={{ boxShadow: "0 4px 16px rgba(99, 95, 199, 0.15)" }}
    >
      <span className="bg-primary text-white rounded-full flex items-center justify-center w-16 h-16 md:w-20 md:h-20 shadow-lg border-4 border-white hover:bg-primary/90 animate-fade-in">
        <PlusCircle size={36} />
      </span>
    </Link>
  );
}
