
import { Play, FileAudio, MessageSquare, Image, Workflow, Zap, Sparkles, Video, Music } from "lucide-react";

export function getCategoryTheme(category: string) {
  const lowerCategory = category?.toLowerCase() || "";
  
  if (lowerCategory.includes('chatgpt') || lowerCategory.includes('text')) {
    return {
      color: 'hsl(var(--primary))',
      gradient: 'from-primary/20 via-primary/10 to-background',
      badgeStyle: 'bg-primary text-primary-foreground',
      icon: MessageSquare,
      tagline: 'Powerful text generation prompts',
      features: ['Text Generation', 'Conversation', 'Writing']
    };
  } else if (lowerCategory.includes('midjourney') || lowerCategory.includes('image')) {
    return {
      color: 'hsl(var(--secondary))',
      gradient: 'from-secondary/20 via-secondary/10 to-background',
      badgeStyle: 'bg-secondary text-secondary-foreground',
      icon: Image,
      tagline: 'Creative visual prompts for stunning images',
      features: ['Image Generation', 'Art Creation', 'Visual Design']
    };
  } else if (lowerCategory.includes('n8n') || lowerCategory.includes('workflow')) {
    return {
      color: 'hsl(245 58% 51%)',
      gradient: 'from-blue-500/20 via-blue-500/10 to-background',
      badgeStyle: 'bg-blue-600 text-white',
      icon: Workflow,
      tagline: 'Automated workflow templates',
      features: ['Automation', 'Integration', 'Productivity']
    };
  } else if (lowerCategory.includes('claude')) {
    return {
      color: 'hsl(25 95% 53%)',
      gradient: 'from-orange-500/20 via-orange-500/10 to-background',
      badgeStyle: 'bg-orange-500 text-white',
      icon: Zap,
      tagline: 'Advanced AI reasoning prompts',
      features: ['Analysis', 'Reasoning', 'Research']
    };
  } else if (lowerCategory.includes('gemini')) {
    return {
      color: 'hsl(262 83% 58%)',
      gradient: 'from-purple-600/20 via-purple-600/10 to-background',
      badgeStyle: 'bg-purple-600 text-white',
      icon: Sparkles,
      tagline: 'Multimodal AI capabilities',
      features: ['Multimodal', 'Code', 'Analysis']
    };
  } else if (lowerCategory.includes('video')) {
    return {
      color: 'hsl(0 84% 60%)',
      gradient: 'from-red-500/20 via-red-500/10 to-background',
      badgeStyle: 'bg-red-500 text-white',
      icon: Video,
      tagline: 'Dynamic video content prompts',
      features: ['Video Generation', 'Motion', 'Storytelling']
    };
  } else if (lowerCategory.includes('audio')) {
    return {
      color: 'hsl(142 76% 36%)',
      gradient: 'from-green-600/20 via-green-600/10 to-background',
      badgeStyle: 'bg-green-600 text-white',
      icon: Music,
      tagline: 'Audio and music generation',
      features: ['Audio Creation', 'Music', 'Sound Design']
    };
  } else {
    return {
      color: 'hsl(var(--primary))',
      gradient: 'from-primary/20 via-primary/10 to-background',
      badgeStyle: 'bg-primary text-primary-foreground',
      icon: MessageSquare,
      tagline: 'Versatile AI prompts',
      features: ['General Purpose', 'Flexible', 'Adaptable']
    };
  }
}

export function getCategoryBadgeStyle(category: string) {
  return getCategoryTheme(category).badgeStyle;
}

export function getMediaTypeIcon(file: { type?: string }) {
  if (file.type === 'video') return <Play className="h-4 w-4 text-white" />;
  if (file.type === 'audio') return <FileAudio className="h-4 w-4 text-white" />;
  return null;
}
