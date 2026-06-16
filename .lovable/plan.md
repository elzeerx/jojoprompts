
# Admin AI Studio — Plan

A new admin section at `/admin/ai-studio` where admins chat with an AI assistant to **generate, preview, refine, and publish** any kind of prompt asset (text prompts, JSON specs, skill packages, image prompts, video/audio prompts, n8n workflows, etc.). Each generation lives as a **draft** that can be edited, regenerated, given a thumbnail, then **published** into the existing prompts catalog visible to end users.

---

## 1. Scope (v1)

Asset types the studio can produce (selectable per message, also auto-detected):

| Type | Output | Preview |
|---|---|---|
| Text prompt (ChatGPT / Claude / Manus) | Markdown body w/ role + instructions + examples | Rendered markdown |
| JSON prompt / structured spec | Validated JSON object | Pretty JSON + "Formatted" tab (reuses existing `jsonPromptFormatter`) |
| Skill package (Claude/Manus) | name + description + instructions + optional script blocks | Markdown + collapsible file tree |
| Image prompt | Prompt text + parameters (e.g. `--ar`, style) | Live AI-generated thumbnail (streamed) |
| Workflow / n8n JSON | JSON workflow | JSON + summary |
| Other / freeform | Any text | Markdown |

"Other" stays a first-class option so admins can generate things outside the taxonomy (e.g. video prompts, audio prompts, agent system messages) without us blocking on a schema.

---

## 2. UX

Two-pane layout under `/admin/ai-studio`:

```text
┌──────────────────────────────────────────────────────────────┐
│  Top bar: [Asset type ▾] [Target LLM ▾] [Image model ▾]      │
├──────────────────────────┬───────────────────────────────────┤
│                          │  Preview pane (tabs)              │
│  Chat with AI            │  ─ Rendered                       │
│  - streamed messages     │  ─ Raw / JSON                     │
│  - tool-call cards       │  ─ Thumbnail (image prompts)      │
│  - "Regenerate" /        │                                   │
│    "Improve" quick chips │  Footer:                          │
│                          │  [Copy] [Download] [Save draft]   │
│  Composer (textarea +    │  [Publish → Prompts]              │
│  attach JSON / image)    │                                   │
└──────────────────────────┴───────────────────────────────────┘
```

Key interactions:
- Admin types a brief ("Generate a Claude skill for resume tailoring").
- AI streams a response and calls a tool (`emit_asset`) that pushes a structured payload into the right-hand preview pane.
- Admin clicks **Generate thumbnail** → streams a Gemini Flash Image / GPT-Image-2 preview into the preview card (model picker per generation).
- Admin can keep chatting ("make it shorter", "add an Arabic version") — each accepted change updates the draft.
- **Save draft** persists it; **Publish** promotes it into `prompts` so it appears in the public catalog.

Sidebar drawer lists previous drafts ("My generations") with status badges (`draft`, `published`).

---

## 3. Architecture

### 3a. Frontend

New files:

```
src/pages/admin/sections/ai-studio/
  AiStudioPage.tsx                 // layout + thread routing
  AiStudioChat.tsx                 // useChat + DefaultChatTransport
  AssetPreviewPane.tsx             // tabs: Rendered / Raw / Thumbnail
  ImagePreviewStream.tsx           // SSE consumer for image gen
  DraftsSidebar.tsx
  PublishDialog.tsx                // title, category, tags, thumbnail, status
  hooks/useAiStudioDraft.ts
  hooks/useImageGeneration.ts      // shared streamImage helper
```

Reuses existing pieces:
- `CopyButton` (just added)
- `jsonPromptFormatter` for JSON preview
- `PromptService.createPrompt` for publish
- `AdminLayout`, `AdminSectionSkeleton`, command palette entry

Nav: add a **Studio** group in `adminNavConfig.ts` → `AI Studio` (icon: `Sparkles`), route `/admin/ai-studio` and `/admin/ai-studio/:draftId`.

### 3b. Backend (Supabase Edge Functions)

Three new functions in `supabase/functions/`:

1. **`ai-studio-chat`** — streaming chat endpoint.
   - Uses AI SDK + Lovable AI Gateway provider helper (`_shared/ai-gateway.ts`).
   - Default model: `google/gemini-3-flash-preview`.
   - System prompt instructs the model to call the `emit_asset` tool with a typed payload `{ kind, title, body, json?, params?, tags?, language? }`.
   - Other tools: `suggest_thumbnail_prompt`, `translate_to_arabic`.
   - `stopWhen: stepCountIs(50)`.
   - Validates the admin JWT in-code, checks `has_role(uid,'admin')`.

2. **`ai-studio-image`** — streaming image generation passthrough.
   - Accepts `{ prompt, model, size }`, forwards to `https://ai.gateway.lovable.dev/v1/images/generations` with `stream: true, partial_images: 1` for OpenAI models; rebuilds the body for Gemini models.
   - Returns the SSE stream untouched; the client renders partial frames with the blur pattern.

3. **`ai-studio-publish`** — promotes a draft to `prompts`.
   - Uploads the chosen thumbnail (data URL → `prompt-images` bucket) and inserts into `prompts` with `metadata.ai_generated = true`, `metadata.source_draft_id`, `metadata.target_llm`, etc.

Shared helper `_shared/ai-gateway.ts` already required by the connection pattern; reused across the three functions.

### 3c. Database

One new table for drafts (the published prompts go into the existing `prompts` table per your choice — only a `metadata.status` flag is added; no destructive change to public schema):

```sql
CREATE TABLE public.ai_studio_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,                      -- admin who created it
  kind text NOT NULL,                         -- 'text' | 'json' | 'skill' | 'image' | 'workflow' | 'other'
  title text,
  body text,                                  -- markdown / instructions
  payload jsonb DEFAULT '{}'::jsonb,          -- structured data (JSON spec, skill files, params)
  target_llm text,                            -- 'chatgpt' | 'claude' | 'manus' | 'gemini' | 'midjourney' | 'generic'
  thumbnail_path text,                        -- storage key in prompt-images
  messages jsonb DEFAULT '[]'::jsonb,         -- UIMessage[] for conversation resume
  status text NOT NULL DEFAULT 'draft',       -- 'draft' | 'published' | 'archived'
  published_prompt_id uuid,                   -- FK-by-convention to prompts.id once published
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_studio_drafts TO authenticated;
GRANT ALL ON public.ai_studio_drafts TO service_role;

ALTER TABLE public.ai_studio_drafts ENABLE ROW LEVEL SECURITY;

-- Admin-only access via existing has_role()
CREATE POLICY "Admins read drafts" ON public.ai_studio_drafts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage own drafts" ON public.ai_studio_drafts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id)
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);
```

No change to `prompts` schema — we use `metadata.status`, `metadata.ai_generated`, `metadata.source_draft_id`.

### 3d. Storage

Reuse the existing **`prompt-images`** bucket for thumbnails. Add a folder convention `ai-studio/{draftId}/{frame}.png`.

---

## 4. Phasing

Shipping in three small phases so each one is reviewable.

### Phase 1 — Chat shell + text/JSON generation (no images, no publish)
- Migration: `ai_studio_drafts` table + RLS + grants.
- Edge function `ai-studio-chat` with `emit_asset` tool.
- `AiStudioPage` + `AiStudioChat` + `AssetPreviewPane` (Rendered + Raw tabs).
- Save draft / load draft / drafts sidebar.
- Nav entry + route + command-palette entry.

### Phase 2 — Image previews + thumbnails
- Edge function `ai-studio-image` (SSE passthrough).
- `ImagePreviewStream` with partial-frame blur.
- Per-generation model picker (Gemini Flash Image default, GPT-Image-2 / Gemini Pro Image as alternatives).
- "Generate thumbnail" action on any draft → stores latest PNG in `prompt-images/ai-studio/{draftId}/`.

### Phase 3 — Publish workflow
- `PublishDialog`: title, description, category, tags, language (EN/AR), thumbnail picker (uploaded or AI-generated), target LLM badge.
- Edge function `ai-studio-publish` → inserts into `prompts`, updates draft `status='published'` + `published_prompt_id`.
- Draft list shows status badges, "Unpublish" reverts metadata.status to `draft`.

(Phase 4 stretch, not in scope yet: skill-package zip export, Manus task export, batch generation, evaluation/scoring.)

---

## 5. Technical details

- Streaming chat uses `useChat` + `DefaultChatTransport` pointed at `${VITE_SUPABASE_URL}/functions/v1/ai-studio-chat` with the publishable key in `Authorization`.
- Conversation history is **per draft**: route is `/admin/ai-studio/:draftId`, messages persisted in `ai_studio_drafts.messages` so admins can resume a generation later. A `/admin/ai-studio` index route creates a new draft and navigates to its id.
- The `emit_asset` tool result is rendered as a structured card in the chat AND piped into the right-hand preview pane via a Zustand store keyed by `draftId`.
- Image generation defaults to `google/gemini-3.1-flash-image-preview` (no `partial_images` field). When the admin switches to an OpenAI image model, the request body is rebuilt server-side to add `prompt`, `quality: "low"`, `partial_images: 1`.
- Publish path uploads the final PNG via the Supabase JS client (admin session) — no service-role key in the browser.
- `LOVABLE_API_KEY` must exist; if missing we'll provision it before deploying functions.

---

## 6. Open questions before build

1. **"Other" asset type** — you selected it alongside the named ones. Anything specific you have in mind (video prompts? audio? agent system prompts?) so I tune the `emit_asset` schema and the preview tabs accordingly? If not, I'll treat it as "freeform markdown" and let the model pick the shape.
2. **Skill packages** — Claude Skills and Manus Skills have different file layouts. Want me to support both with a "flavor" selector, or pick one for v1?
3. **Auto-publish to Arabic** — should the AI always produce bilingual output (EN + AR fields) for text/JSON prompts, or only when admin asks?

I can start Phase 1 as soon as you confirm (or just say "go" and I'll use the defaults above: freeform "Other" = markdown, Claude+Manus skill flavor selector, bilingual only on request).
