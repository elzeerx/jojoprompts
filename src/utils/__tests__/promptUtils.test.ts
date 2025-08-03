import { 
  extractPromptMetadata, 
  isWorkflowPrompt, 
  getPromptTitle, 
  getPromptDescription,
  hasMediaFiles,
  hasWorkflowFiles,
  getPrimaryImagePath
} from '../promptUtils';
import { createMockPrompt } from '../testUtils';

describe('Prompt Utilities', () => {
  describe('extractPromptMetadata', () => {
    it('should extract metadata from prompt with full metadata', () => {
      const prompt = createMockPrompt({
        metadata: {
          category: 'chatgpt',
          style: 'professional',
          tags: ['test', 'example'],
          workflow_steps: ['step1', 'step2'],
          workflow_files: ['file1.json', 'file2.json'],
          media_files: ['image1.png', 'image2.jpg'],
          use_case: 'testing',
          target_model: 'gpt-4'
        }
      });

      const result = extractPromptMetadata(prompt);

      expect(result).toEqual({
        category: 'chatgpt',
        style: 'professional',
        tags: ['test', 'example'],
        workflowSteps: ['step1', 'step2'],
        workflowFiles: ['file1.json', 'file2.json'],
        mediaFiles: ['image1.png', 'image2.jpg'],
        useCase: 'testing',
        targetModel: 'gpt-4'
      });
    });

    it('should handle prompt with minimal metadata', () => {
      const prompt = createMockPrompt({
        metadata: {
          category: 'midjourney'
        }
      });

      const result = extractPromptMetadata(prompt);

      expect(result).toEqual({
        category: 'midjourney',
        style: undefined,
        tags: [],
        workflowSteps: [],
        workflowFiles: [],
        mediaFiles: [],
        useCase: undefined,
        targetModel: undefined
      });
    });

    it('should handle prompt with no metadata', () => {
      const prompt = createMockPrompt({
        metadata: undefined
      });

      const result = extractPromptMetadata(prompt);

      expect(result).toEqual({
        category: 'N/A',
        style: undefined,
        tags: [],
        workflowSteps: [],
        workflowFiles: [],
        mediaFiles: [],
        useCase: undefined,
        targetModel: undefined
      });
    });

    it('should handle prompt with null metadata', () => {
      const prompt = createMockPrompt({
        metadata: null
      });

      const result = extractPromptMetadata(prompt);

      expect(result).toEqual({
        category: 'N/A',
        style: undefined,
        tags: [],
        workflowSteps: [],
        workflowFiles: [],
        mediaFiles: [],
        useCase: undefined,
        targetModel: undefined
      });
    });
  });

  describe('isWorkflowPrompt', () => {
    it('should return true for n8n workflow category', () => {
      const prompt = createMockPrompt({
        metadata: {
          category: 'n8n workflow'
        }
      });

      expect(isWorkflowPrompt(prompt)).toBe(true);
    });

    it('should return true for workflow category', () => {
      const prompt = createMockPrompt({
        metadata: {
          category: 'workflow'
        }
      });

      expect(isWorkflowPrompt(prompt)).toBe(true);
    });

    it('should return true for workflow prompt type', () => {
      const prompt = createMockPrompt({
        prompt_type: 'workflow'
      });

      expect(isWorkflowPrompt(prompt)).toBe(true);
    });

    it('should return false for non-workflow prompt', () => {
      const prompt = createMockPrompt({
        metadata: {
          category: 'chatgpt'
        }
      });

      expect(isWorkflowPrompt(prompt)).toBe(false);
    });

    it('should handle case-insensitive category matching', () => {
      const prompt = createMockPrompt({
        metadata: {
          category: 'N8N WORKFLOW'
        }
      });

      expect(isWorkflowPrompt(prompt)).toBe(true);
    });

    it('should handle case-insensitive prompt type matching', () => {
      const prompt = createMockPrompt({
        prompt_type: 'WORKFLOW'
      });

      expect(isWorkflowPrompt(prompt)).toBe(true);
    });
  });

  describe('getPromptTitle', () => {
    it('should return title when available', () => {
      const prompt = createMockPrompt({
        title: 'Test Prompt Title'
      });

      expect(getPromptTitle(prompt)).toBe('Test Prompt Title');
    });

    it('should return truncated prompt text when title is not available', () => {
      const prompt = createMockPrompt({
        title: undefined,
        prompt_text: 'This is a very long prompt text that should be truncated to 50 characters'
      });

      expect(getPromptTitle(prompt)).toBe('This is a very long prompt text that should be truncat...');
    });

    it('should return "Untitled Prompt" when neither title nor prompt_text is available', () => {
      const prompt = createMockPrompt({
        title: undefined,
        prompt_text: undefined
      });

      expect(getPromptTitle(prompt)).toBe('Untitled Prompt');
    });

    it('should handle empty title and prompt_text', () => {
      const prompt = createMockPrompt({
        title: '',
        prompt_text: ''
      });

      expect(getPromptTitle(prompt)).toBe('Untitled Prompt');
    });
  });

  describe('getPromptDescription', () => {
    it('should return description when available', () => {
      const prompt = createMockPrompt({
        description: 'This is a test description'
      });

      expect(getPromptDescription(prompt)).toBe('This is a test description');
    });

    it('should return truncated prompt text when description is not available', () => {
      const prompt = createMockPrompt({
        description: undefined,
        prompt_text: 'This is a very long prompt text that should be truncated to 100 characters and then have ellipsis added'
      });

      expect(getPromptDescription(prompt)).toBe('This is a very long prompt text that should be truncated to 100 characters and then have ellipsis adde...');
    });

    it('should return fallback message when no description or prompt_text is available', () => {
      const prompt = createMockPrompt({
        description: undefined,
        prompt_text: undefined
      });

      expect(getPromptDescription(prompt)).toBe('No description available');
    });

    it('should handle empty description and prompt_text', () => {
      const prompt = createMockPrompt({
        description: '',
        prompt_text: ''
      });

      expect(getPromptDescription(prompt)).toBe('No description available');
    });
  });

  describe('hasMediaFiles', () => {
    it('should return true when media files are present', () => {
      const prompt = createMockPrompt({
        metadata: {
          media_files: ['image1.png', 'image2.jpg']
        }
      });

      expect(hasMediaFiles(prompt)).toBe(true);
    });

    it('should return false when no media files are present', () => {
      const prompt = createMockPrompt({
        metadata: {
          media_files: []
        }
      });

      expect(hasMediaFiles(prompt)).toBe(false);
    });

    it('should return false when media_files is undefined', () => {
      const prompt = createMockPrompt({
        metadata: {
          media_files: undefined
        }
      });

      expect(hasMediaFiles(prompt)).toBe(false);
    });

    it('should return false when metadata is undefined', () => {
      const prompt = createMockPrompt({
        metadata: undefined
      });

      expect(hasMediaFiles(prompt)).toBe(false);
    });
  });

  describe('hasWorkflowFiles', () => {
    it('should return true when workflow files are present', () => {
      const prompt = createMockPrompt({
        metadata: {
          workflow_files: ['workflow1.json', 'workflow2.json']
        }
      });

      expect(hasWorkflowFiles(prompt)).toBe(true);
    });

    it('should return false when no workflow files are present', () => {
      const prompt = createMockPrompt({
        metadata: {
          workflow_files: []
        }
      });

      expect(hasWorkflowFiles(prompt)).toBe(false);
    });

    it('should return false when workflow_files is undefined', () => {
      const prompt = createMockPrompt({
        metadata: {
          workflow_files: undefined
        }
      });

      expect(hasWorkflowFiles(prompt)).toBe(false);
    });

    it('should return false when metadata is undefined', () => {
      const prompt = createMockPrompt({
        metadata: undefined
      });

      expect(hasWorkflowFiles(prompt)).toBe(false);
    });
  });

  describe('getPrimaryImagePath', () => {
    it('should return primary image from media files', () => {
      const prompt = createMockPrompt({
        metadata: {
          media_files: [
            { type: 'image', path: '/images/primary.jpg' },
            { type: 'video', path: '/videos/video.mp4' }
          ]
        }
      });

      expect(getPrimaryImagePath(prompt)).toBe('/images/primary.jpg');
    });

    it('should return image_path when no media files', () => {
      const prompt = createMockPrompt({
        image_path: '/images/fallback.jpg',
        metadata: {
          media_files: []
        }
      });

      expect(getPrimaryImagePath(prompt)).toBe('/images/fallback.jpg');
    });

    it('should return image_url when no image_path or media files', () => {
      const prompt = createMockPrompt({
        image_url: '/images/url.jpg',
        image_path: undefined,
        metadata: {
          media_files: []
        }
      });

      expect(getPrimaryImagePath(prompt)).toBe('/images/url.jpg');
    });

    it('should return default_image_path when no other image sources', () => {
      const prompt = createMockPrompt({
        default_image_path: '/images/default.jpg',
        image_path: undefined,
        image_url: undefined,
        metadata: {
          media_files: []
        }
      });

      expect(getPrimaryImagePath(prompt)).toBe('/images/default.jpg');
    });

    it('should return placeholder when no image sources available', () => {
      const prompt = createMockPrompt({
        image_path: undefined,
        image_url: undefined,
        default_image_path: undefined,
        metadata: {
          media_files: []
        }
      });

      expect(getPrimaryImagePath(prompt)).toBe('/placeholder.svg');
    });

    it('should prioritize media files over other image sources', () => {
      const prompt = createMockPrompt({
        image_path: '/images/fallback.jpg',
        image_url: '/images/url.jpg',
        default_image_path: '/images/default.jpg',
        metadata: {
          media_files: [
            { type: 'image', path: '/images/primary.jpg' }
          ]
        }
      });

      expect(getPrimaryImagePath(prompt)).toBe('/images/primary.jpg');
    });
  });
}); 