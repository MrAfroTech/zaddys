import { useCallback, useEffect, useMemo, useState } from 'react';

/** Display-side copies of the order limits; the server enforces the real ones. */
export const CART_LIMITS = {
  online: { maxQty: 15, maxItems: 40, maxTotalCents: 25000 },
  staff: { maxQty: 50, maxItems: 150, maxTotalCents: 100000 },
};

function read(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((l) => typeof l?.id === 'string' && Number.isInteger(l.quantity) && l.quantity > 0)
      : [];
  } catch {
    return [];
  }
}

/**
 * Cart = [{ id, quantity }] only. Names and prices are looked up from the
 * current menu for display; the server recomputes everything at checkout.
 * Persisted per `storageKey` so a refresh doesn't empty it.
 */
/** Same rounding as the database (Florida s.212.12(10)); display estimate only. */
export function estimateTaxCents(subtotalCents, rateBp) {
  return Math.floor((subtotalCents * (rateBp || 0) + 5000) / 10000);
}

export function useCart(storageKey, menuItems, limits = CART_LIMITS.online) {
  const MAX_QTY = limits.maxQty;
  const [lines, setLines] = useState(() => read(storageKey));

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {
      /* storage unavailable (private mode) — cart still works in memory */
    }
  }, [storageKey, lines]);

  const add = useCallback((id) => {
    setLines((cur) => {
      const found = cur.find((l) => l.id === id);
      if (found) return cur.map((l) => (l.id === id ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + 1) } : l));
      return [...cur, { id, quantity: 1 }];
    });
  }, [MAX_QTY]);

  const setQuantity = useCallback((id, quantity) => {
    setLines((cur) =>
      quantity < 1
        ? cur.filter((l) => l.id !== id)
        : cur.map((l) => (l.id === id ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)),
    );
  }, [MAX_QTY]);

  const remove = useCallback((id) => setLines((cur) => cur.filter((l) => l.id !== id)), []);
  // Writes storage immediately too: checkout clears the cart and then navigates
  // away straight after, before the effect above would run.
  const clear = useCallback(() => {
    setLines([]);
    try {
      window.localStorage.setItem(storageKey, '[]');
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const detailed = useMemo(() => {
    const byId = new Map((menuItems || []).map((m) => [m.id, m]));
    return lines.map((l) => {
      const item = byId.get(l.id);
      return {
        ...l,
        item,
        unavailable: !item || !item.isAvailable,
        lineTotalCents: item ? item.priceCents * l.quantity : 0,
      };
    });
  }, [lines, menuItems]);

  const subtotalCents = detailed.reduce((sum, l) => sum + (l.unavailable ? 0 : l.lineTotalCents), 0);
  const itemCount = detailed.reduce((sum, l) => sum + l.quantity, 0);
  const hasUnavailable = detailed.some((l) => l.unavailable);
  const overLimit = itemCount > limits.maxItems || subtotalCents > limits.maxTotalCents;

  return {
    lines: detailed, add, setQuantity, remove, clear, subtotalCents, itemCount, hasUnavailable, overLimit, limits,
  };
}
