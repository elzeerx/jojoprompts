import { useState, useMemo } from "react";
import { ALL_PROMPT_TYPES, ModelPromptType } from "@/utils/promptTypes";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, Image, Video, Music, Workflow, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelPromptTypeSelectorProps {
  selectedTypeId: string;
  onSelect: (type: ModelPromptType) => void;
}

// Group prompt types by category
const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; label: string; order: number }> = {
  'ChatGPT': { icon: <MessageSquare className="h-4 w-4" />, label: '💬 Text & Chat', order: 1 },
  'Claude': { icon: <MessageSquare className="h-4 w-4" />, label: '🧠 Claude AI', order: 2 },
  'Midjourney': { icon: <Image className="h-4 w-4" />, label: '🎨 Midjourney', order: 3 },
  'Gemini': { icon: <Sparkles className="h-4 w-4" />, label: '✨ Gemini', order: 4 },
  'Flux': { icon: <Image className="h-4 w-4" />, label: '🖼️ Flux', order: 5 },
  'Video': { icon: <Video className="h-4 w-4" />, label: '🎬 Video AI', order: 6 },
  'Sora': { icon: <Video className="h-4 w-4" />, label: '🎥 Sora', order: 7 },
  'ElevenLabs': { icon: <Music className="h-4 w-4" />, label: '🎵 Voice & Audio', order: 8 },
  'Suno': { icon: <Music className="h-4 w-4" />, label: '🎶 Suno Music', order: 9 },
  'n8n': { icon: <Workflow className="h-4 w-4" />, label: '⚙️ Workflows', order: 10 },
};

export function ModelPromptTypeSelector({ selectedTypeId, onSelect }: ModelPromptTypeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Group and filter prompt types
  const groupedTypes = useMemo(() => {
    const filtered = searchQuery
      ? ALL_PROMPT_TYPES.filter(type => 
          type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          type.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          type.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : ALL_PROMPT_TYPES;

    const groups: Record<string, ModelPromptType[]> = {};
    filtered.forEach(type => {
      if (!groups[type.category]) {
        groups[type.category] = [];
      }
      groups[type.category].push(type);
    });

    // Sort categories by order
    return Object.entries(groups).sort((a, b) => {
      const orderA = CATEGORY_CONFIG[a[0]]?.order ?? 99;
      const orderB = CATEGORY_CONFIG[b[0]]?.order ?? 99;
      return orderA - orderB;
    });
  }, [searchQuery]);

  // Find currently selected type
  const selectedType = ALL_PROMPT_TYPES.find(t => t.id === selectedTypeId);

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium">Prompt Type</label>
      
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search prompt types..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Selected Type Display */}
      {selectedType && (
        <div 
          className="p-3 rounded-lg border-2 bg-[hsl(var(--warm-gold))]/10"
          style={{ borderColor: selectedType.color || 'hsl(var(--warm-gold))' }}
        >
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: selectedType.color || 'hsl(var(--warm-gold))' }}
            />
            <span className="font-medium text-sm">{selectedType.name}</span>
            <Badge variant="secondary" className="text-xs ml-auto">
              {selectedType.category}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{selectedType.description}</p>
        </div>
      )}

      {/* Categorized Type List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {groupedTypes.map(([category, types]) => {
          const config = CATEGORY_CONFIG[category] || { label: category, order: 99 };
          const isExpanded = expandedCategory === category || searchQuery.length > 0;
          
          return (
            <div key={category} className="border rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                type="button"
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className="w-full p-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium">{config.label}</span>
                <Badge variant="outline" className="text-xs">
                  {types.length} {types.length === 1 ? 'type' : 'types'}
                </Badge>
              </button>
              
              {/* Types List */}
              {isExpanded && (
                <div className="p-2 space-y-1 bg-background">
                  {types.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => onSelect(type)}
                      className={cn(
                        "w-full p-2 rounded-md text-left transition-all",
                        "hover:bg-muted/50 border border-transparent",
                        selectedTypeId === type.id && "border-[hsl(var(--warm-gold))] bg-[hsl(var(--warm-gold))]/5"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: type.color || 'hsl(var(--muted-foreground))' }}
                        />
                        <span className="text-sm font-medium truncate">{type.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 pl-4">
                        {type.description}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {groupedTypes.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">No prompt types found</p>
          <p className="text-xs">Try a different search term</p>
        </div>
      )}
    </div>
  );
}
