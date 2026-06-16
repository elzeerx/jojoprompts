export type AiAssetKind =
  | "text"
  | "json"
  | "skill"
  | "image"
  | "workflow"
  | "other";

export type AiTargetLlm =
  | "chatgpt"
  | "claude"
  | "manus"
  | "gemini"
  | "midjourney"
  | "generic";

export interface AiAssetPayload {
  kind: AiAssetKind;
  title?: string;
  body?: string;
  json?: unknown;
  params?: Record<string, unknown>;
  target_llm?: string;
  tags?: string[];
  language?: "en" | "ar" | "bilingual";
}

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  asset?: AiAssetPayload | null;
}

export interface AiStudioDraft {
  id: string;
  user_id: string;
  kind: AiAssetKind;
  title: string | null;
  body: string | null;
  payload: AiAssetPayload | Record<string, unknown>;
  target_llm: string | null;
  thumbnail_path: string | null;
  messages: ChatMsg[];
  status: "draft" | "published" | "archived";
  published_prompt_id: string | null;
  created_at: string;
  updated_at: string;
}
