
import { Badge } from "@/components/ui/badge";

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {tags.slice(0, 3).map((tag, i) => (
        <span
          key={i}
          className="bg-secondary text-secondary-foreground px-2 py-0.5 text-xs font-mono"
        >
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="border border-border px-2 py-0.5 text-xs font-mono">
          +{tags.length - 3}
        </span>
      )}
    </div>
  );
}
