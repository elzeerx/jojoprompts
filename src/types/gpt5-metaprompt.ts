export interface GPT5MetapromptRequest {
  subject: string;
  output_format: string;
  constraints?: string[];
  style?: string[];
  audience?: string[];
  goal?: string[];
  quick_request?: string;
}

export interface GPT5MetapromptResponse {
  metaprompt_json: {
    metaprompt: {
      role_instruction: string;
      task_instruction: string;
      constraints: string;
      placeholders: string[];
      example_usage?: string;
    };
  };
  metaprompt_template: string;
  autofill_suggestions: {
    style: string[];
    subject: string[];
    effects: string[];
    audience: string[];
    goal: string[];
  };
}

export interface MetapromptFieldOptions {
  subjects: string[];
  output_formats: string[];
  constraints: string[];
  styles: string[];
  audiences: string[];
  goals: string[];
}