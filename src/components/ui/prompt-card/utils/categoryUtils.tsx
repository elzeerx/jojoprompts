
import { Play, FileAudio } from "lucide-react";

export function getCategoryBadgeStyle(category: string) {
  const lowerCategory = category?.toLowerCase() || "";
  if (lowerCategory.includes('chatgpt') || lowerCategory.includes('text')) {
    return 'bg-[#c49d68] text-white'; // Warm gold
  } else if (lowerCategory.includes('midjourney') || lowerCategory.includes('image')) {
    return 'bg-[#7a9e9f] text-white'; // Muted teal
  } else if (lowerCategory.includes('n8n') || lowerCategory.includes('workflow')) {
    return 'bg-blue-600 text-white'; // Blue
  } else if (lowerCategory.includes('claude')) {
    return 'bg-orange-500 text-white'; // Orange
  } else if (lowerCategory.includes('gemini')) {
    return 'bg-purple-600 text-white'; // Purple
  } else if (lowerCategory.includes('video')) {
    return 'bg-red-500 text-white'; // Red
  } else if (lowerCategory.includes('audio')) {
    return 'bg-green-600 text-white'; // Green
  } else {
    return 'bg-gray-600 text-white'; // Default gray
  }
}

export function getMediaTypeIcon(file: { type?: string }) {
  if (file.type === 'video') return <Play className="h-4 w-4 text-white" />;
  if (file.type === 'audio') return <FileAudio className="h-4 w-4 text-white" />;
  return null;
}
