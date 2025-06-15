
import { Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import React from "react";

export function LockedOverlay({ onUpgradeClick }: { onUpgradeClick?: () => void }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center z-20 rounded-2xl">
      <div className="bg-black/80 backdrop-blur-sm p-3 sm:p-4 lg:p-6 rounded-xl flex flex-col items-center text-center max-w-[85%] sm:max-w-[90%]">
        <Lock className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-[#c49d68] mb-2 sm:mb-3" />
        <p className="text-white font-semibold text-xs sm:text-sm mb-1">Premium Content</p>
        <p className="text-white/80 text-xs sm:text-sm mb-2 sm:mb-3 lg:mb-4 max-w-[200px]">
          Upgrade your plan to access this content
        </p>
        <Button
          variant="outline"
          size="sm"
          className="bg-[#c49d68]/90 text-white hover:bg-[#c49d68] border-[#c49d68] text-xs"
          onClick={e => {
            e.stopPropagation();
            if (onUpgradeClick) onUpgradeClick();
          }}
        >
          <Crown className="h-3 w-3 mr-1" />
          Upgrade Plan
        </Button>
      </div>
    </div>
  );
}
