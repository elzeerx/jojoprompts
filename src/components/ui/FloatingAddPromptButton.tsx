
import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { PromptWizardDialog } from "@/components/prompts";
import { cn } from "@/lib/utils";

interface FloatingAddPromptButtonProps {
  reloadPrompts: () => Promise<void>;
  className?: string;
}

export function FloatingAddPromptButton({ reloadPrompts, className }: FloatingAddPromptButtonProps) {
  const { user } = useAuth();
  const { canManagePrompts, loading } = useUserPermissions();

  // Only render for users with prompt management permissions
  if (!user || !canManagePrompts || loading) return null;

  const handleComplete = async () => {
    // Reload prompts to refresh the list
    await reloadPrompts();
  };

  return (
    <PromptWizardDialog
      trigger={
        <button
          type="button"
          aria-label="Add Prompt"
          title="Add Prompt"
          className={cn(
            "fixed z-50 bottom-8 right-8 md:bottom-10 md:right-10 transition-transform animate-fade-in hover:scale-110 peer",
            className
          )}
        >
          <div className="group relative flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full">
            {/* Animated glow effect */}
            <div 
              className="absolute inset-0 rounded-full opacity-70 blur-md transition-all duration-300 group-hover:opacity-100"
              style={{ 
                background: "radial-gradient(circle, rgba(196, 157, 104, 0.5) 0%, rgba(196, 157, 104, 0.2) 70%, transparent 100%)"
              }}
            />
            
            {/* Button background with subtle gradient */}
            <div 
              className="absolute inset-0 rounded-full border border-warm-gold/30 bg-gradient-to-br from-white to-soft-bg shadow-lg transition-all duration-300 group-hover:border-warm-gold/50 group-hover:shadow-warm-gold/20"
            />
            
            {/* Plus icon */}
            <PlusCircle
              size={52}
              strokeWidth={1.5}
              className="relative z-10 text-warm-gold transition-all duration-300 group-hover:text-warm-gold/90 group-hover:rotate-90"
            />
          </div>
        </button>
      }
      mode="create"
      onComplete={handleComplete}
    />
  );
}
