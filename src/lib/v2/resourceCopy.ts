/**
 * Imported legacy summaries sometimes end with an acquisition instruction.
 * That sentence is useful in public discovery but becomes incorrect once the
 * resource is already in a customer's library.
 */
export function withoutAcquisitionInstruction(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/\s*Acquire it to unlock the complete prompt\.\s*$/i, "")
    .replace(/\s*احصل عليه لفتح البرومبت الكامل[.؟!]?\s*$/u, "")
    .trim();
  return cleaned || null;
}
