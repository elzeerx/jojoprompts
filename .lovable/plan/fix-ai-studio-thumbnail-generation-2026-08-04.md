# Fix AI Studio thumbnail generation

## What's wrong

Two problems combine into the "Image stream ended without a completion event" toast:

1. **Invalid model ids.** The picker sends `google/gemini-3.1-flash-image-preview` and `google/gemini-3-pro-image-preview`. The supported gateway ids have no `-preview` suffix: `google/gemini-3.1-flash-image` and `google/gemini-3-pro-image`. An unsupported id is rejected by the gateway.
2. **Errors are silently swallowed.** The gateway opens the SSE stream before the upstream responds, so failures arrive as an in-band `error` event. The client parser ignores every event that isn't `partial_image`/`completed`, so the real message (bad model, rate limit, credits, moderation) is dropped and the user only sees the generic "no completion event" warning.

## Changes

**`src/pages/admin/sections/ai-studio/ImagePreviewStream.tsx`**
- Correct the model list ids (drop `-preview` on both Gemini 3.1 Flash and Gemini 3 Pro), keep labels as-is.
- Handle failure frames in the SSE parser: treat `event.event === "error"` or a payload whose `type` is `"error"` as terminal, capture `error.message`, and surface it via `toast.error` instead of the generic warning.
- Keep reading until the HTTP body ends; only warn about a missing completion event when no error was reported.

**`supabase/functions/ai-studio-image/index.ts`**
- Change the default model to `google/gemini-3-pro-image` (documented default) and validate the incoming `model` against an allowlist of the five supported ids, returning a clear 400 for anything else rather than proxying an id the gateway will reject.
- Log the upstream status/body on non-OK responses so failures are visible in edge function logs.

## Verification

Generate a thumbnail from the AI Studio draft with each model in the picker and confirm partial frames render and the final image is savable; force a failure (empty credits / bad id) and confirm the real error text shows in the toast.
