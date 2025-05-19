
import { Button } from "@/components/ui/button";
import { type Prompt } from "@/types";
import { ArrowRight } from "lucide-react";

interface PromptsContentProps {
  view: "grid" | "list";
  filteredPrompts: Prompt[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  category: string;
  promptType: "image" | "text" | "all";
  onClearFilters: () => void;
  selectedPrompts?: string[];
  onSelectPrompt?: (id: string) => void;
}

export function PromptsContent({
  filteredPrompts, isLoading, error, searchQuery, category,
  onClearFilters
}: PromptsContentProps) {
  // Array of background colors from our palette to rotate through
  const bgColors = [
    'bg-soft-bg', 'bg-warm-gold/20', 'bg-muted-teal/20'
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground mb-3">Loading prompts...</p>
        <div className="h-1.5 w-64 bg-secondary overflow-hidden">
          <div className="h-full bg-warm-gold animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-destructive mb-6 text-lg">{error}</p>
        <Button
          variant="outline"
          className="px-8 py-2 text-base font-bold border-warm-gold/20"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (filteredPrompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground mb-6 text-lg">
          {searchQuery || category !== "all"
            ? "No prompts found matching your search."
            : "No prompts available."}
        </p>
        {(searchQuery || category !== "all") && (
          <Button
            variant="outline"
            className="px-8 py-2 text-base font-bold border-warm-gold/20"
            onClick={onClearFilters}
          >
            Clear Filters
          </Button>
        )}
      </div>
    );
  }

  // Group prompts into sets of 3 for the layout pattern
  const groupedPrompts = [];
  for (let i = 0; i < filteredPrompts.length; i += 3) {
    const group = filteredPrompts.slice(i, i + 3);
    groupedPrompts.push(group);
  }

  return (
    <div className="space-y-8">
      {groupedPrompts.map((group, groupIndex) => (
        <div key={groupIndex} className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
          {/* First card (large vertical) */}
          {group[0] && (
            <div className="md:col-span-1">
              <CustomPromptCard 
                prompt={group[0]} 
                colorIndex={(groupIndex * 3) % bgColors.length} 
                bgColors={bgColors} 
                isLarge={true}
              />
            </div>
          )}
          
          {/* Container for the two horizontal cards */}
          <div className="md:col-span-2 space-y-4">
            {/* Second card (horizontal) */}
            {group[1] && (
              <CustomPromptCard 
                prompt={group[1]} 
                colorIndex={(groupIndex * 3 + 1) % bgColors.length} 
                bgColors={bgColors} 
                isLarge={false}
                isHorizontal={true}
              />
            )}
            
            {/* Third card (horizontal) */}
            {group[2] && (
              <CustomPromptCard 
                prompt={group[2]} 
                colorIndex={(groupIndex * 3 + 2) % bgColors.length} 
                bgColors={bgColors} 
                isLarge={false}
                isHorizontal={true}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface CustomPromptCardProps {
  prompt: Prompt;
  colorIndex: number;
  bgColors: string[];
  isLarge?: boolean;
  isHorizontal?: boolean;
}

function CustomPromptCard({ prompt, colorIndex, bgColors, isLarge = false, isHorizontal = false }: CustomPromptCardProps) {
  const { title, prompt_text, metadata, prompt_type } = prompt;
  const tags = metadata?.tags || [];
  const bgColor = bgColors[colorIndex];
  const category = prompt_type === 'text' ? 'ChatGPT' : 'Midjourney';
  
  return (
    <div 
      className={`${bgColor} p-5 cursor-pointer transition-all duration-300 hover:shadow-md`}
      onClick={() => console.log("Prompt card clicked:", prompt.id)}
    >
      {isHorizontal ? (
        <div className="flex flex-col md:flex-row md:h-40 gap-5">
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="inline-block px-2 py-0.5 text-xs font-medium bg-black/10 mb-2">
                {category}
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-dark-base tracking-tight mb-2">
                {title}
              </h3>
              <p className="text-sm text-dark-base/70 line-clamp-2">
                {prompt_text}
              </p>
            </div>
            <Button 
              variant="ghost" 
              className="mt-3 w-fit text-dark-base hover:bg-black/10 p-0 h-auto font-medium"
            >
              Get Started <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-shrink-0 w-full md:w-1/3 h-32 md:h-auto overflow-hidden">
            <img 
              src={prompt.image_path || '/img/placeholder.png'} 
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      ) : (
        <div className={`flex flex-col ${isLarge ? 'h-auto md:h-[500px]' : 'h-auto'}`}>
          <div className="inline-block px-2 py-0.5 text-xs font-medium bg-black/10 mb-2">
            {category}
          </div>
          
          <h3 className="text-xl md:text-2xl font-bold text-dark-base tracking-tight mb-2">
            {title}
          </h3>
          
          <p className="text-sm text-dark-base/70 mb-4 line-clamp-2">
            {prompt_text}
          </p>
          
          <div className="flex-grow mt-4 mb-4 overflow-hidden">
            <img 
              src={prompt.image_path || '/img/placeholder.png'} 
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
          
          <Button 
            variant="ghost" 
            className="mt-auto w-fit text-dark-base hover:bg-black/10 p-0 h-auto font-medium"
          >
            Get Started <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
