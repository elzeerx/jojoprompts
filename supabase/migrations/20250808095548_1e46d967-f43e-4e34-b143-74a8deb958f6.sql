-- Create email_templates table for admin-managed email content
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  locale TEXT NOT NULL DEFAULT 'en',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies: Admins only full access
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can view email templates" ON public.email_templates;

CREATE POLICY "Admins can manage email templates"
ON public.email_templates
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Optional explicit SELECT policy (redundant given ALL above but clearer)
CREATE POLICY "Admins can view email templates"
ON public.email_templates
FOR SELECT
USING (is_admin());

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER trg_update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_email_templates_updated_at();

-- Seed initial templates with jojoprompts.com links and placeholders
INSERT INTO public.email_templates (slug, name, type, subject, html, text, variables)
VALUES
  (
    'welcome', 'Welcome Email', 'welcome',
    'Welcome to JoJo Prompts, {{first_name}}',
    '<h1>Welcome, {{first_name}}!</h1><p>We\'re excited to have you at JoJo Prompts.</p><p>Get started here: <a href="https://jojoprompts.com">jojoprompts.com</a></p>',
    'Welcome, {{first_name}}! Get started at https://jojoprompts.com',
    '{"first_name":"User"}'
  ),
  (
    'email_confirmation', 'Email Confirmation', 'email_confirmation',
    'Confirm your email, {{first_name}}',
    '<h1>Confirm your email</h1><p>Hi {{first_name}}, please confirm your email to continue.</p><p><a href="{{confirmation_link}}">Confirm Email</a></p><p>If the button does not work, copy this link: {{confirmation_link}}</p>',
    'Hi {{first_name}}, confirm your email: {{confirmation_link}}',
    '{"first_name":"User","confirmation_link":"https://jojoprompts.com/email-confirmation?token=..."}'
  ),
  (
    'plan_reminder', 'Plan Reminder', 'marketing',
    'Unlock Premium Features – Choose your plan',
    '<h2>Hi {{first_name}},</h2><p>You haven\'t selected a subscription plan yet. You\'re missing out on premium AI prompts!</p><p><a href="https://jojoprompts.com/pricing">Choose your plan</a></p><p><a href="{{unsubscribe_link}}">Unsubscribe</a></p>',
    'Hi {{first_name}}, choose your plan: https://jojoprompts.com/pricing\nUnsubscribe: {{unsubscribe_link}}',
    '{"first_name":"User","unsubscribe_link":"https://jojoprompts.com/unsubscribe?email=user@example.com"}'
  ),
  (
    'plan_selection_nudge', 'Plan Selection Nudge', 'marketing',
    'Complete your setup – pick a plan',
    '<h2>Pick a plan</h2><p>Continue by selecting a plan that fits you.</p><p><a href="https://jojoprompts.com/pricing">View plans</a></p>',
    'Select a plan at https://jojoprompts.com/pricing',
    '{}'
  ),
  (
    'password_reset', 'Password Reset', 'password_reset',
    'Reset your JoJo Prompts password',
    '<h2>Password reset</h2><p>Click to reset: <a href="{{reset_link}}">Reset Password</a></p><p>If the button does not work, copy this link: {{reset_link}}</p>',
    'Reset your password: {{reset_link}}',
    '{"reset_link":"https://jojoprompts.com/reset?token=..."}'
  ),
  (
    'marketing_general', 'Marketing General', 'marketing',
    'Latest from JoJo Prompts',
    '<h2>New features</h2><p>Discover what\'s new.</p><p><a href="https://jojoprompts.com">Explore</a></p><p><a href="{{unsubscribe_link}}">Unsubscribe</a></p>',
    'Discover what\'s new at https://jojoprompts.com\nUnsubscribe: {{unsubscribe_link}}',
    '{"unsubscribe_link":"https://jojoprompts.com/unsubscribe?email=user@example.com"}'
  )
ON CONFLICT (slug) DO NOTHING;