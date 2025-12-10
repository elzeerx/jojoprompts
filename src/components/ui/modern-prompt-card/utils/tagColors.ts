// Tag color utility for consistent pill styling across cards

export function getTagPillStyle(tag: string): string {
  const lower = tag?.toLowerCase() || '';
  
  // Text AI platforms
  if (lower.includes('text') || lower.includes('chatgpt') || lower.includes('gpt')) {
    return 'text-emerald-700 bg-emerald-50';
  }
  
  // Image AI platforms  
  if (lower.includes('image') || lower.includes('midjourney') || lower.includes('flux') || lower.includes('dall')) {
    return 'text-blue-700 bg-blue-50';
  }
  
  // Video AI platforms
  if (lower.includes('video') || lower.includes('sora') || lower.includes('runway')) {
    return 'text-pink-700 bg-pink-50';
  }
  
  // Audio/Voice AI platforms
  if (lower.includes('audio') || lower.includes('voice') || lower.includes('elevenlabs')) {
    return 'text-violet-700 bg-violet-50';
  }
  
  // Music AI platforms
  if (lower.includes('music') || lower.includes('suno')) {
    return 'text-purple-700 bg-purple-50';
  }
  
  // Workflow/Code platforms
  if (lower.includes('workflow') || lower.includes('n8n') || lower.includes('code') || lower.includes('cursor')) {
    return 'text-amber-700 bg-amber-50';
  }
  
  // Research platforms
  if (lower.includes('research') || lower.includes('perplexity') || lower.includes('fact')) {
    return 'text-teal-700 bg-teal-50';
  }
  
  // Default
  return 'text-gray-700 bg-gray-100';
}

// Get category-based color for model type badge
export function getCategoryPillStyle(category: string): string {
  const lower = category?.toLowerCase() || '';
  
  if (lower.includes('chatgpt')) return 'text-emerald-700 bg-emerald-50';
  if (lower.includes('midjourney')) return 'text-blue-700 bg-blue-50';
  if (lower.includes('gemini')) return 'text-purple-700 bg-purple-50';
  if (lower.includes('claude')) return 'text-orange-700 bg-orange-50';
  if (lower.includes('flux')) return 'text-indigo-700 bg-indigo-50';
  if (lower.includes('sora')) return 'text-pink-700 bg-pink-50';
  if (lower.includes('elevenlabs')) return 'text-violet-700 bg-violet-50';
  if (lower.includes('n8n') || lower.includes('workflow')) return 'text-amber-700 bg-amber-50';
  
  return 'text-gray-700 bg-gray-100';
}
