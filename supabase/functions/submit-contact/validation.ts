// Pure validation for submit-contact, split from index.ts to keep tests
// free of npm:resend imports.

import { hasOnlyAllowedKeys, normalizeEmail } from '../_shared/emailCommon.ts';

const MAX_NAME = 120;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

const ALLOWED_TOP_LEVEL_KEYS = [
  'submission_id', 'name', 'email', 'subject', 'message',
] as const;

export function validateSubmissionId(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function nonEmptyString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

export interface ParsedContact {
  submission_id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function validateContact(raw: Record<string, unknown>): ParsedContact | { error: string } {
  if (!hasOnlyAllowedKeys(raw, ALLOWED_TOP_LEVEL_KEYS)) return { error: 'unknown_field' };
  if (!validateSubmissionId(raw.submission_id)) return { error: 'invalid_submission_id' };
  if (!nonEmptyString(raw.name, MAX_NAME)) return { error: 'invalid_name' };
  if (!nonEmptyString(raw.subject, MAX_SUBJECT)) return { error: 'invalid_subject' };
  if (!nonEmptyString(raw.message, MAX_MESSAGE)) return { error: 'invalid_message' };
  const email = normalizeEmail(raw.email);
  if (!email) return { error: 'invalid_email' };
  return {
    submission_id: (raw.submission_id as string).toLowerCase(),
    name: (raw.name as string).trim(),
    email,
    subject: (raw.subject as string).trim(),
    message: (raw.message as string).trim(),
  };
}
