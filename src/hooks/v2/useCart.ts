/**
 * V2 cart hook — global, versioned localStorage store.
 *
 * Design notes:
 *  - Cart is a lightweight singleton (module-level state + subscription set).
 *    No provider required; every consumer of useCart() re-renders on change.
 *  - Only stores product UUIDs + minimal presentation snapshot (title/type/lang).
 *    Server is ALWAYS authoritative for availability, price, ownership, discount.
 *  - Guests may modify; sign-in is required only to begin checkout.
 *  - Version bump on shape change invalidates prior payloads safely.
 */

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "jojo:v2:cart:v1";
const CART_VERSION = 1;
export const CART_MAX_ITEMS = 50;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_PRODUCT_TYPES = new Set(["individual", "bundle", "lifetime", "free"]);

export type AddCartResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "cap_reached" | "invalid" };

export interface CartSnapshot {
  product_id: string;
  /** Presentation-only; server re-derives real title from products/resources. */
  snapshot: {
    title_en: string;
    title_ar: string | null;
    resource_type: string | null;
    product_type: "individual" | "bundle" | "lifetime" | "free";
  };
  added_at: string;
}

interface StoredCart {
  version: number;
  items: CartSnapshot[];
}

type Listener = () => void;

function isValidSnapshot(x: unknown): x is CartSnapshot {
  if (!x || typeof x !== "object") return false;
  const i = x as Record<string, unknown>;
  if (typeof i.product_id !== "string" || !UUID_RE.test(i.product_id)) return false;
  if (typeof i.added_at !== "string" || i.added_at.length > 40) return false;
  const s = i.snapshot as Record<string, unknown> | undefined;
  if (!s || typeof s !== "object") return false;
  if (typeof s.title_en !== "string" || s.title_en.length > 200) return false;
  if (s.title_ar !== null && (typeof s.title_ar !== "string" || (s.title_ar as string).length > 200)) return false;
  if (s.resource_type !== null && (typeof s.resource_type !== "string" || (s.resource_type as string).length > 64)) return false;
  if (typeof s.product_type !== "string" || !ALLOWED_PRODUCT_TYPES.has(s.product_type)) return false;
  return true;
}

function readCart(): CartSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCart;
    if (!parsed || parsed.version !== CART_VERSION) return [];
    if (!Array.isArray(parsed.items)) return [];
    const seen = new Set<string>();
    const cleaned: CartSnapshot[] = [];
    for (const item of parsed.items) {
      if (!isValidSnapshot(item)) continue;
      if (seen.has(item.product_id)) continue;
      seen.add(item.product_id);
      cleaned.push(item);
      if (cleaned.length >= CART_MAX_ITEMS) break;
    }
    return cleaned;
  } catch {
    return [];
  }
}

let state: CartSnapshot[] = readCart();
const listeners = new Set<Listener>();

function persist() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: CART_VERSION, items: state } satisfies StoredCart),
    );
  } catch {
    // storage quota / private mode: drop silently
  }
  listeners.forEach((l) => l());
}

function setState(next: CartSnapshot[]) {
  state = next;
  persist();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      state = readCart();
      listeners.forEach((l) => l());
    }
  });
}

export function useCart() {
  const [snapshot, setSnapshot] = useState<CartSnapshot[]>(state);

  useEffect(() => {
    const l: Listener = () => setSnapshot([...state]);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const has = useCallback(
    (productId: string) => snapshot.some((i) => i.product_id === productId),
    [snapshot],
  );

  const add = useCallback((item: Omit<CartSnapshot, "added_at">): AddCartResult => {
    const candidate: CartSnapshot = { ...item, added_at: new Date().toISOString() };
    if (!isValidSnapshot(candidate)) return { ok: false, reason: "invalid" };
    if (state.some((i) => i.product_id === item.product_id)) {
      return { ok: false, reason: "duplicate" };
    }
    if (state.length >= CART_MAX_ITEMS) {
      return { ok: false, reason: "cap_reached" };
    }
    setState([...state, candidate]);
    return { ok: true };
  }, []);

  const remove = useCallback((productId: string) => {
    setState(state.filter((i) => i.product_id !== productId));
  }, []);

  const clear = useCallback(() => {
    setState([]);
  }, []);

  /** Remove items after a verified paid result. */
  const removeMany = useCallback((productIds: string[]) => {
    const set = new Set(productIds);
    setState(state.filter((i) => !set.has(i.product_id)));
  }, []);

  return {
    items: snapshot,
    count: snapshot.length,
    has,
    add,
    remove,
    removeMany,
    clear,
  };
}

/** Non-React helpers, used by the checkout flow to clear purchased items. */
export const cartStore = {
  read: () => [...state],
  removeMany: (productIds: string[]) => {
    const set = new Set(productIds);
    setState(state.filter((i) => !set.has(i.product_id)));
  },
};
