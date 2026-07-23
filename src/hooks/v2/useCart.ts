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

function readCart(): CartSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCart;
    if (!parsed || parsed.version !== CART_VERSION) return [];
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.filter(
      (i) => typeof i?.product_id === "string" && i.product_id.length === 36,
    );
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

  const add = useCallback((item: Omit<CartSnapshot, "added_at">) => {
    if (state.some((i) => i.product_id === item.product_id)) return;
    setState([...state, { ...item, added_at: new Date().toISOString() }]);
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
