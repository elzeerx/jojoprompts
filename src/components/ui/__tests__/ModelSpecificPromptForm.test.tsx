import React from 'react';
import { render, screen } from '@testing-library/react';
import { ModelSpecificPromptForm } from '../ModelSpecificPromptForm';

// Mock the dependencies
jest.mock('@/utils/promptTypes', () => ({
  ALL_PROMPT_TYPES: [
    {
      id: 'test-prompt',
      name: 'Test Prompt',
      description: 'A test prompt type',
      category: 'Test',
      fields: [
        {
          id: 'promptText',
          name: 'Prompt Text',
          type: 'textarea',
          required: true,
          placeholder: 'Enter prompt...'
        }
      ],
      validation: {
        required: ['promptText'],
        optional: []
      },
      examples: ['Example 1', 'Example 2'],
      tips: ['Tip 1', 'Tip 2'],
      color: '#000000'
    }
  ],
  getPromptTypeById: jest.fn((id) => ({
    id: 'test-prompt',
    name: 'Test Prompt',
    description: 'A test prompt type',
    category: 'Test',
    fields: [
      {
        id: 'promptText',
        name: 'Prompt Text',
        type: 'textarea',
        required: true,
        placeholder: 'Enter prompt...'
      }
    ],
    validation: {
      required: ['promptText'],
      optional: []
    },
    examples: ['Example 1', 'Example 2'],
    tips: ['Tip 1', 'Tip 2'],
    color: '#000000'
  })),
  validatePromptData: jest.fn(() => ({}))
}));

jest.mock('@/utils/promptValidation', () => ({
  usePromptValidation: jest.fn(() => ({
    isValid: true,
    errors: {},
    warnings: {},
    qualityScore: 100,
    suggestions: []
  }))
}));

jest.mock('@/hooks/useAutoSave', () => ({
  usePromptAutoSave: jest.fn(() => ({
    isSaving: false,
    lastSaved: null,
    drafts: [],
    saveDraft: jest.fn(),
    restoreDraft: jest.fn(),
    deleteDraft: jest.fn(),
    clearDrafts: jest.fn(),
    getLatestDraft: jest.fn()
  }))
}));

describe('ModelSpecificPromptForm', () => {
  it('renders without crashing', () => {
    const mockOnChange = jest.fn();
    
    render(
      <ModelSpecificPromptForm
        value={{}}
        onChange={mockOnChange}
      />
    );

    // Should render the prompt type selection
    expect(screen.getByText('Select Prompt Type')).toBeInTheDocument();
  });

  it('shows prompt type options', () => {
    const mockOnChange = jest.fn();
    
    render(
      <ModelSpecificPromptForm
        value={{}}
        onChange={mockOnChange}
      />
    );

    // Should show the test prompt type
    expect(screen.getByText('Test Prompt')).toBeInTheDocument();
  });
}); 