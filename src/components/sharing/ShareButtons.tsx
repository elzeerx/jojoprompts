
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Copy, Twitter, Linkedin, Check } from "lucide-react";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { toast } from "@/hooks/use-toast";

interface ShareButtonsProps {
  promptId: string;
  promptTitle: string;
  className?: string;
}

export function ShareButtons({ promptId, promptTitle, className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const { trackShare } = useUsageTracking();

  const promptUrl = `${window.location.origin}/prompts?id=${promptId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(promptUrl);
      setCopied(true);
      await trackShare(promptId, 'link');
      toast({
        title: "Success",
        description: "Link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleTwitterShare = async () => {
    const text = `Check out this amazing prompt: "${promptTitle}"`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(promptUrl)}`;
    window.open(twitterUrl, '_blank');
    await trackShare(promptId, 'twitter');
  };

  const handleLinkedInShare = async () => {
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(promptUrl)}`;
    window.open(linkedinUrl, '_blank');
    await trackShare(promptId, 'linkedin');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={`border-warm-gold/20 hover:bg-warm-gold/10 ${className}`}>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border border-warm-gold/20">
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          Copy Link
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleTwitterShare}>
          <Twitter className="h-4 w-4 mr-2" />
          Share on Twitter
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleLinkedInShare}>
          <Linkedin className="h-4 w-4 mr-2" />
          Share on LinkedIn
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
