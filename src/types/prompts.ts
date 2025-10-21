import { type Prompt as BasePrompt } from "@/types";

// Local types to avoid circular imports
export interface PromptMetadata {
  category?: string;
  tags?: string[];
  style?: string;
  model?: string;
  use_case?: string;
  target_model?: string;
  workflow_steps?: { step_number: number; title: string; description: string; }[];
  media_files?: { type: string; path: string; }[];
  workflow_files?: { type: string; path: string; name: string; }[];
  [key: string]: any;
}

// Extended prompt type with uploader info for display
export interface PromptRow extends BasePrompt {
  uploader_name?: string;
  uploader_username?: string;
  // Add any display-specific fields
}

// Filter and search types
export interface PromptFilters {
  category: string;
  searchQuery: string;
  promptType: PromptTypeFilter;
  tags: string[];
  sortBy: SortOption;
  sortOrder: 'asc' | 'desc';
}

export type PromptType = 'image' | 'text' | 'video' | 'workflow';
export type PromptTypeFilter = 'all' | PromptType;
export type SortOption = 'created_at' | 'title' | 'category';

// View preferences
export interface PromptViewState {
  view: ViewMode;
  itemsPerPage: number;
  page: number;
}

export type ViewMode = 'grid' | 'list';

// Service layer types
export interface PromptQuery {
  category?: string;
  search?: string;
  type?: PromptTypeFilter;
  tags?: string[];
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PromptQueryResult {
  data: PromptRow[];
  count: number;
  error?: string;
}

// Media file types for better metadata handling
export interface MediaFile {
  type: 'image' | 'video' | 'audio';
  path: string;
  url?: string;
  size?: number;
  mimeType?: string;
}

export interface WorkflowFile {
  type: 'workflow' | 'config' | 'json';
  path: string;
  name: string;
  description?: string;
}

// Enhanced metadata with proper typing
export interface EnhancedPromptMetadata extends PromptMetadata {
  media_files?: MediaFile[];
  workflow_files?: WorkflowFile[];
  target_model?: string;
  workflow_steps?: EnhancedWorkflowStep[];
}

export interface EnhancedWorkflowStep {
  step_number: number;
  title: string;
  description: string;
  tool?: string;
  settings?: Record<string, any>;
}