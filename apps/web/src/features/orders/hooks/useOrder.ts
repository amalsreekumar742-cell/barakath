'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrderProps } from '@barakath/shared';
import { fetchOrder } from '../api/orders';

export interface UseOrderResult {
  order: OrderProps | null;
  loading: boolean;
  error: string | null;
  /** True once the fetch has resolved and the order is either missing or not owned by the caller —
   *  `fetchOrder` deliberately collapses both into the same outcome (see its own header). */
  notFound: boolean;
  refresh: () => void;
}

/**
 * One order, shared by Order Detail, Tracking and Invoice — all three render the same document, so
 * arriving at one from another costs no extra read once loaded (mirrors `OrderDetailProvider` being
 * shared across those same three Flutter screens).
 */
export function useOrder(orderId: string, uid: string | null): UseOrderResult {
  const [order, setOrder] = useState<OrderProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const result = await fetchOrder(orderId, uid);
      if (!result) {
        setNotFound(true);
        setOrder(null);
      } else {
        setOrder(result);
      }
    } catch {
      setError('Could not load this order. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [orderId, uid]);

  useEffect(() => {
    void load();
  }, [load]);

  return { order, loading, error, notFound, refresh: load };
}
