
import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { CopyButton } from "./copy-button";
import { Badge } from "./badge";
import { cn } from "@/lib/utils";
import { type Prompt } from "@/types";
import { BookText } from "lucide-react";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";

interface TextPromptCardProps {
  prompt: Prompt;
  className?: string;
}

export function TextPromptCard({ prompt, className }: TextPromptCardProps) {
  const { title, prompt_text, metadata } = prompt;
  const tags = metadata?.tags || [];
  const model = metadata?.target_model || 'ChatGPT';
  const useCase = metadata?.use_case;
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <>
      <Card 
        className={cn(
          "overflow-hidden transition-all duration-200 hover:shadow-lg group cursor-pointer bg-gradient-to-b from-card to-card/95",
          className
        )}
        onClick={() => setDetailsOpen(true)}
      >
        <CardHeader className="p-4 pb-2 flex items-start gap-3">
          <BookText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg font-semibold leading-tight line-clamp-1">
              {title}
            </CardTitle>
            {useCase && (
              <Badge variant="secondary" className="text-xs">
                {useCase}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4 min-h-[5em]">
            {prompt_text}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-xs font-medium">
              {model}
            </Badge>
            {tags.slice(0, 2).map((tag, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-xs font-medium"
              >
                {tag}
              </Badge>
            ))}
            {tags.length > 2 && (
              <Badge variant="outline" className="text-xs font-medium">
                +{tags.length - 2}
              </Badge>
            )}
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0">
          <CopyButton value={prompt_text} className="w-full" />
        </CardFooter>
      </Card>

      <PromptDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        prompt={prompt}
      />
    </>
  );
}
