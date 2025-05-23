
import { Badge } from "@/components/ui/badge";

interface PromptTagsProps {
  model: string;
  useCase?: string;
  tags: string[];
}

export function PromptTags({ model, useCase, tags }: PromptTagsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary" className="bg-white/60 text-gray-700 border-gray-200">
        {model}
      </Badge>
      {useCase && (
        <Badge variant="secondary" className="bg-white/60 text-gray-700 border-gray-200">
          {useCase}
        </Badge>
      )}
      {tags.slice(0, 4).map((tag, i) => (
        <Badge
          key={i}
          variant="secondary"
          className="bg-white/60 text-gray-700 border-gray-200"
        >
          {tag}
        </Badge>
      ))}
      {tags.length > 4 && (
        <Badge variant="secondary" className="bg-white/60 text-gray-500 border-gray-200">
          +{tags.length - 4} more
        </Badge>
      )}
    </div>
  );
}
