
import { Play, FileAudio, Sparkles, Wand2, Video, Mic, Music, Type, Code, Search, Bot, BrainCircuit } from "lucide-react";

export function getCategoryBadgeStyle(category: string) {
  const lowerCategory = category?.toLowerCase() || "";
  if (lowerCategory.includes('chatgpt') || lowerCategory.includes('text')) {
    return 'bg-[#10a37f] text-white'; // ChatGPT green
  } else if (lowerCategory.includes('midjourney') || lowerCategory.includes('image')) {
    return 'bg-[#7a9e9f] text-white'; // Muted teal
  } else if (lowerCategory.includes('n8n') || lowerCategory.includes('workflow')) {
    return 'bg-blue-600 text-white'; // Blue
  } else if (lowerCategory.includes('claude')) {
    return 'bg-orange-500 text-white'; // Orange
  } else if (lowerCategory.includes('gemini')) {
    return 'bg-purple-600 text-white'; // Purple
  } else if (lowerCategory.includes('video') || lowerCategory.includes('sora') || lowerCategory.includes('runway')) {
    return 'bg-rose-600 text-white'; // Rose for video
  } else if (lowerCategory.includes('audio') || lowerCategory.includes('elevenlabs') || lowerCategory.includes('voice')) {
    return 'bg-emerald-600 text-white'; // Emerald for voice
  } else if (lowerCategory.includes('suno') || lowerCategory.includes('music')) {
    return 'bg-violet-600 text-white'; // Violet for music
  } else if (lowerCategory.includes('flux') || lowerCategory.includes('stable')) {
    return 'bg-indigo-600 text-white'; // Indigo for Flux
  } else if (lowerCategory.includes('ideogram')) {
    return 'bg-amber-600 text-white'; // Amber for Ideogram
  } else if (lowerCategory.includes('cursor') || lowerCategory.includes('code')) {
    return 'bg-slate-700 text-white'; // Slate for code
  } else if (lowerCategory.includes('perplexity') || lowerCategory.includes('research')) {
    return 'bg-teal-600 text-white'; // Teal for research
  } else if (lowerCategory.includes('gpt') && lowerCategory.includes('builder')) {
    return 'bg-cyan-600 text-white'; // Cyan for GPT Builder
  } else {
    return 'bg-gray-600 text-white'; // Default gray
  }
}

export function getMediaTypeIcon(file: { type?: string }) {
  if (file.type === 'video') return <Play className="h-4 w-4 text-white" />;
  if (file.type === 'audio') return <FileAudio className="h-4 w-4 text-white" />;
  return null;
}

// Get platform icon based on model type or category
export function getPlatformIcon(modelType: string | undefined, className: string = "h-4 w-4") {
  const type = modelType?.toLowerCase() || "";
  
  if (type.includes('chatgpt') || type.includes('gpt')) {
    return <Bot className={className} />;
  } else if (type.includes('gemini')) {
    return <Sparkles className={className} />;
  } else if (type.includes('flux') || type.includes('stable')) {
    return <Wand2 className={className} />;
  } else if (type.includes('midjourney')) {
    return <Wand2 className={className} />;
  } else if (type.includes('sora') || type.includes('runway') || type.includes('video')) {
    return <Video className={className} />;
  } else if (type.includes('elevenlabs') || type.includes('voice')) {
    return <Mic className={className} />;
  } else if (type.includes('suno') || type.includes('music')) {
    return <Music className={className} />;
  } else if (type.includes('ideogram')) {
    return <Type className={className} />;
  } else if (type.includes('cursor') || type.includes('code')) {
    return <Code className={className} />;
  } else if (type.includes('perplexity') || type.includes('research')) {
    return <Search className={className} />;
  } else if (type.includes('claude')) {
    return <BrainCircuit className={className} />;
  }
  
  return null;
}

// Get platform display name from model type ID
export function getPlatformName(modelType: string | undefined): string | null {
  const type = modelType?.toLowerCase() || "";
  
  if (type.includes('chatgpt-text')) return 'ChatGPT';
  if (type.includes('chatgpt-image')) return 'DALL-E';
  if (type.includes('chatgpt-gpt-builder')) return 'GPTs Builder';
  if (type.includes('gemini')) return 'Gemini';
  if (type.includes('flux')) return 'Flux';
  if (type.includes('midjourney-full')) return 'Midjourney';
  if (type.includes('midjourney-style')) return 'MJ Style Ref';
  if (type.includes('sora')) return 'Sora';
  if (type.includes('elevenlabs')) return 'ElevenLabs';
  if (type.includes('suno')) return 'Suno';
  if (type.includes('video')) return 'Video AI';
  if (type.includes('workflow')) return 'n8n';
  if (type.includes('claude')) return 'Claude';
  
  return null;
}

// Get badge style based on model type
export function getModelBadgeStyle(modelType: string | undefined): string {
  const type = modelType?.toLowerCase() || "";
  
  if (type.includes('chatgpt')) return 'bg-[#10a37f]/20 text-[#10a37f] border-[#10a37f]/30';
  if (type.includes('gemini')) return 'bg-purple-500/20 text-purple-600 border-purple-500/30';
  if (type.includes('flux')) return 'bg-indigo-500/20 text-indigo-600 border-indigo-500/30';
  if (type.includes('midjourney')) return 'bg-[#7a9e9f]/20 text-[#7a9e9f] border-[#7a9e9f]/30';
  if (type.includes('sora') || type.includes('video')) return 'bg-rose-500/20 text-rose-600 border-rose-500/30';
  if (type.includes('elevenlabs')) return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30';
  if (type.includes('suno')) return 'bg-violet-500/20 text-violet-600 border-violet-500/30';
  if (type.includes('workflow')) return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
  if (type.includes('claude')) return 'bg-orange-500/20 text-orange-600 border-orange-500/30';
  
  return 'bg-gray-500/20 text-gray-600 border-gray-500/30';
}
