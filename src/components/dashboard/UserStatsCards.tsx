import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, BookOpen } from "lucide-react";

interface UserStatsCardsProps {
  favoriteCount: number;
  promptCount: number;
}

export function UserStatsCards({ favoriteCount, promptCount }: UserStatsCardsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Favorites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{favoriteCount}</div>
          <p className="text-sm text-muted-foreground">Prompts saved to favorites</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            My Prompts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{promptCount}</div>
          <p className="text-sm text-muted-foreground">Prompts you've created</p>
        </CardContent>
      </Card>
    </div>
  );
}