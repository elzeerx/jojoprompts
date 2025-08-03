import { Prompt, PromptRow } from "@/types";

// Utility to extract metadata from prompts consistently
export function extractPromptMetadata(prompt: Prompt | PromptRow) {
  return {
    category: prompt.metadata?.category || "N/A",
    style: prompt.metadata?.style,
    tags: prompt.metadata?.tags || [],
    workflowSteps: prompt.metadata?.workflow_steps || [],
    workflowFiles: prompt.metadata?.workflow_files || [],
    mediaFiles: prompt.metadata?.media_files || [],
    useCase: prompt.metadata?.use_case,
    targetModel: prompt.metadata?.target_model
  };
}

// Utility to check if prompt is a workflow type
export function isWorkflowPrompt(prompt: Prompt | PromptRow): boolean {
  const category = prompt.metadata?.category?.toLowerCase() || '';
  const promptType = prompt.prompt_type?.toLowerCase() || '';
  
  return category.includes('n8n') || 
         category.includes('workflow') || 
         promptType === 'workflow';
}

// Utility to get prompt display title with fallback
export function getPromptTitle(prompt: Prompt | PromptRow): string {
  return prompt.title || prompt.prompt_text?.substring(0, 50) || 'Untitled Prompt';
}

// Utility to get prompt description with fallback
export function getPromptDescription(prompt: Prompt | PromptRow): string {
  return (prompt as any).description || 
         prompt.prompt_text?.substring(0, 100) + '...' || 
         'No description available';
}

// Utility to check if prompt has media files
export function hasMediaFiles(prompt: Prompt | PromptRow): boolean {
  const mediaFiles = prompt.metadata?.media_files || [];
  return mediaFiles.length > 0;
}

// Utility to check if prompt has workflow files
export function hasWorkflowFiles(prompt: Prompt | PromptRow): boolean {
  const workflowFiles = prompt.metadata?.workflow_files || [];
  return workflowFiles.length > 0;
}

// Utility to get primary image path for a prompt
export function getPrimaryImagePath(prompt: Prompt | PromptRow): string {
  const mediaFiles = prompt.metadata?.media_files || [];
  const primaryImage = mediaFiles.find(file => file.type === 'image');
  
  return primaryImage?.path || 
         prompt.image_path || 
         prompt.image_url || 
         prompt.default_image_path || 
         '/placeholder.svg';
} 