
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collection } from "@/hooks/useCollections";
import { MoreHorizontal, Edit, Trash2, Eye, EyeOff, Calendar, Hash } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CollectionCardProps {
  collection: Collection;
  onEdit?: (collection: Collection) => void;
  onDelete?: (id: string) => void;
  onView?: (collection: Collection) => void;
}

export function CollectionCard({ collection, onEdit, onDelete, onView }: CollectionCardProps) {
  const promptCount = collection.prompt_count || 0;

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border border-warm-gold/20 bg-background">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold text-foreground truncate">
              {collection.name}
            </CardTitle>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={collection.is_public ? "default" : "secondary"} className="text-xs">
                {collection.is_public ? (
                  <><Eye className="h-3 w-3 mr-1" /> Public</>
                ) : (
                  <><EyeOff className="h-3 w-3 mr-1" /> Private</>
                )}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" />
                {promptCount} prompt{promptCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border border-warm-gold/20">
              {onView && (
                <DropdownMenuItem onClick={() => onView(collection)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Collection
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(collection)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={() => onDelete(collection.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      {collection.description && (
        <CardContent className="pt-0 pb-3">
          <CardDescription className="line-clamp-2">
            {collection.description}
          </CardDescription>
        </CardContent>
      )}
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Created {formatDistanceToNow(new Date(collection.created_at))} ago
          </div>
          
          {onView && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(collection)}
              className="text-warm-gold hover:text-warm-gold/80 hover:bg-warm-gold/10 h-7 px-2"
            >
              View →
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
