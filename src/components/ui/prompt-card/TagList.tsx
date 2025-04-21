
import { Badge } from "@/components/ui/badge";

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {tags.slice(0, 3).map((tag, i) => (
        <Badge
          key={i}
          variant="secondary"
          className="text-xs font-medium px-2 py-0.5"
        >
          {tag}
        </Badge>
      ))}
      {tags.length > 3 && (
        <Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
          +{tags.length - 3}
        </Badge>
      )}
    </div>
  );
}
