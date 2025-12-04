import { GPTConfiguration } from './GPTsBuilderWizard';

/**
 * Transform database modelFields format to GPTConfiguration format
 * Handles both old-format (from database) and new-format (from wizard) data
 */
export function transformModelFieldsToGPTConfig(modelFields: Record<string, any>): GPTConfiguration {
  if (!modelFields) {
    return {
      name: '',
      description: '',
      systemPrompt: '',
      conversationStarters: ['', '', '', ''],
      capabilities: {
        webBrowsing: false,
        codeInterpreter: false,
        dallE: false,
        fileSearch: false,
      },
      customActions: '',
    };
  }

  // Handle capabilities - could be array of strings or object with booleans
  const capabilities = modelFields.capabilities || [];
  const capabilitiesObj = Array.isArray(capabilities)
    ? {
        webBrowsing: capabilities.includes('web_browsing'),
        codeInterpreter: capabilities.includes('code_interpreter'),
        dallE: capabilities.includes('dalle'),
        fileSearch: capabilities.includes('file_upload'),
      }
    : {
        webBrowsing: capabilities.webBrowsing || false,
        codeInterpreter: capabilities.codeInterpreter || false,
        dallE: capabilities.dallE || false,
        fileSearch: capabilities.fileSearch || false,
      };

  // Handle conversation starters - could be string with newlines or array
  let conversationStarters: string[] = ['', '', '', ''];
  if (typeof modelFields.conversation_starters === 'string') {
    conversationStarters = modelFields.conversation_starters
      .split('\n')
      .filter((s: string) => s.trim())
      .slice(0, 4);
  } else if (Array.isArray(modelFields.conversationStarters)) {
    conversationStarters = modelFields.conversationStarters;
  } else if (Array.isArray(modelFields.conversation_starters)) {
    conversationStarters = modelFields.conversation_starters;
  }

  return {
    name: modelFields.gpt_name || modelFields.name || '',
    description: modelFields.gpt_description || modelFields.description || '',
    systemPrompt: modelFields.promptText || modelFields.systemPrompt || '',
    conversationStarters,
    capabilities: capabilitiesObj,
    customActions: modelFields.customActions || modelFields.custom_actions || '',
  };
}
