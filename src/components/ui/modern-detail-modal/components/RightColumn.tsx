import React, { useState } from 'react';
import { Copy, X, Share2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfigurationSection } from './ConfigurationSection';
import { toast } from '@/hooks/use-toast';

interface RightColumnProps {
  promptText: string;
  modelFields?: Record<string, any>;
  modelType?: string;
  category?: string;
  onClose?: () => void;
  onShare?: () => void;
  isRTL?: boolean;
}

export function RightColumn({
  promptText,
  modelFields,
  modelType,
  category,
  onClose,
  onShare,
  isRTL = false
}: RightColumnProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Prompt text has been copied to your clipboard"
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'AI Prompt',
        text: promptText,
      }).catch(() => {});
    } else {
      onShare?.();
    }
  };

  return (
    <div className={cn(
      "w-full md:w-7/12",
      "p-4 sm:p-6 md:p-8",
      "flex flex-col bg-white overflow-y-auto"
    )}>
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          {isRTL ? 'النص' : 'The Prompt'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className={cn(
              "p-2 text-gray-400 hover:bg-gray-100 rounded-full",
              "transition-colors min-h-[40px] min-w-[40px]",
              "flex items-center justify-center touch-manipulation"
            )}
            aria-label="Share"
          >
            <Share2 size={18} />
          </button>
          <button
            onClick={onClose}
            className={cn(
              "hidden md:flex p-2 text-gray-400 hover:bg-gray-100 rounded-full",
              "transition-colors min-h-[40px] min-w-[40px]",
              "items-center justify-center touch-manipulation"
            )}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Prompt Box */}
      <div className="relative group flex-1 min-h-[200px] sm:min-h-[300px] mb-4 sm:mb-6">
        <textarea
          className={cn(
            "w-full h-full resize-none p-4 sm:p-5 pb-14",
            "bg-gray-50 rounded-xl",
            "border-2 border-transparent",
            "focus:border-gray-200 focus:bg-white focus:outline-none",
            "text-gray-700 font-mono text-sm leading-7",
            "transition-all",
            isRTL && "text-right"
          )}
          readOnly
          value={promptText}
          dir={isRTL ? 'rtl' : 'ltr'}
        />

        {/* Floating Copy Button */}
        <button
          onClick={handleCopy}
          className={cn(
            "absolute bottom-3 sm:bottom-4",
            isRTL ? "left-3 sm:left-4" : "right-3 sm:right-4",
            "flex items-center gap-2",
            "px-3 sm:px-4 py-2 rounded-lg",
            "text-sm font-medium",
            "transition-transform active:scale-95 shadow-lg",
            "min-h-[40px] touch-manipulation",
            copied 
              ? "bg-green-600 text-white" 
              : "bg-black text-white hover:bg-gray-800"
          )}
        >
          {copied ? (
            <>
              <Check size={16} />
              <span className="hidden sm:inline">Copied</span>
            </>
          ) : (
            <>
              <Copy size={16} />
              <span className="hidden sm:inline">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Configuration Section */}
      <ConfigurationSection
        modelFields={modelFields}
        modelType={modelType}
        category={category}
        isRTL={isRTL}
      />
    </div>
  );
}
