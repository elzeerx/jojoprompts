import { useEffect, useState } from "react";

/**
 * Persistent per-fingerprint idempotency key. Retries with the same cart
 * reuse the same key. Changing the fingerprint (cart contents or discount
 * code) mints a new key.
 */
const STORAGE_KEY = "jojo:v2:checkout:idem:v1";

interface Stored {
  fingerprint: string;
  key: string;
  created_at: string;
}

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `k_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function read(): Stored | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function write(v: Stored | null) {
  try {
    if (v) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function useIdempotencyKey(fingerprint: string): {
  key: string;
  reset: () => void;
} {
  const [key, setKey] = useState<string>(() => {
    const prior = read();
    if (prior && prior.fingerprint === fingerprint) return prior.key;
    const k = newKey();
    write({ fingerprint, key: k, created_at: new Date().toISOString() });
    return k;
  });

  useEffect(() => {
    const prior = read();
    if (!prior || prior.fingerprint !== fingerprint) {
      const k = newKey();
      write({ fingerprint, key: k, created_at: new Date().toISOString() });
      setKey(k);
    }
  }, [fingerprint]);

  return {
    key,
    reset: () => {
      write(null);
      setKey(newKey());
    },
  };
}

export function clearIdempotencyKey() {
  write(null);
}
