import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonPromptCard() {
  return (
    <Card className="h-full bg-background border border-border/30">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between">
          <Skeleton className="h-6 w-20 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-14 rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}