// Small UUID helper for browser code. Always emits a canonical RFC 4122 v4
// UUID so server-side validators that require the exact
// 8-4-4-4-12 hex layout accept both native and fallback paths.

export function generateUuidV4(): string {
  // Prefer the native crypto.randomUUID when available (Chromium ≥92, Safari
  // ≥15.4, Firefox ≥95, all evergreen mobile browsers).
  if (typeof crypto !== "undefined" && typeof (crypto as Crypto).randomUUID === "function") {
    return (crypto as Crypto).randomUUID();
  }

  // Fallback: 16 CSPRNG bytes with the v4/variant bits set per RFC 4122.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    // Extremely unlikely in modern browsers; Math.random is a last resort so
    // the form still submits with a valid-shape UUID rather than a broken id.
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") + "-" +
    hex.slice(4, 6).join("") + "-" +
    hex.slice(6, 8).join("") + "-" +
    hex.slice(8, 10).join("") + "-" +
    hex.slice(10, 16).join("")
  );
}

// Same shape check the submit-contact edge function enforces server-side.
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
