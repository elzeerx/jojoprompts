CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.ai_studio_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  title text,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_llm text DEFAULT 'chatgpt',
  thumbnail_path text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  published_prompt_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_studio_drafts TO authenticated;
GRANT ALL ON public.ai_studio_drafts TO service_role;

ALTER TABLE public.ai_studio_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all drafts" ON public.ai_studio_drafts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'jadmin'));

CREATE POLICY "Admins insert own drafts" ON public.ai_studio_drafts
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'jadmin'))
    AND auth.uid() = user_id
  );

CREATE POLICY "Admins update own drafts" ON public.ai_studio_drafts
  FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'jadmin'))
    AND auth.uid() = user_id
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'jadmin'))
    AND auth.uid() = user_id
  );

CREATE POLICY "Admins delete own drafts" ON public.ai_studio_drafts
  FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'jadmin'))
    AND auth.uid() = user_id
  );

CREATE INDEX idx_ai_studio_drafts_user ON public.ai_studio_drafts(user_id, updated_at DESC);

CREATE TRIGGER ai_studio_drafts_set_updated_at
  BEFORE UPDATE ON public.ai_studio_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();