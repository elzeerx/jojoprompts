import { PromptFormData } from '@/types/prompt-form';
import { Platform } from '@/types/platform';
import { formatPromptForPlatform } from './promptFormatter';

/**
 * Export prompt as plain text format
 */
export function exportAsText(data: PromptFormData, platform: Platform): string {
  const formatted = formatPromptForPlatform(data, platform);
  return `
TITLE: ${formatted.title}
PLATFORM: ${platform.name}
CATEGORY: ${platform.category}

PROMPT:
${formatted.fullPrompt}

CONFIGURATION:
${formatted.platformSpecific}
  `.trim();
}

/**
 * Export prompt as markdown format
 */
export function exportAsMarkdown(data: PromptFormData, platform: Platform): string {
  const formatted = formatPromptForPlatform(data, platform);
  return `
# ${formatted.title}

**Platform:** ${platform.name}  
**Category:** ${platform.category}

## Prompt

\`\`\`
${formatted.fullPrompt}
\`\`\`

## Configuration

\`\`\`json
${formatted.platformSpecific}
\`\`\`
  `.trim();
}

/**
 * Export prompt as JSON format
 */
export function exportAsJSON(data: PromptFormData, platform: Platform): string {
  return JSON.stringify({
    title: data.title,
    platform: platform.name,
    prompt: data.prompt_text,
    configuration: data.platform_fields,
    metadata: {
      category: platform.category,
      created: new Date().toISOString()
    }
  }, null, 2);
}

/**
 * Download exported content as a file
 */
export function downloadPromptFile(
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
