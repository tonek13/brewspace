"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api-client";

/**
 * Subscribes to the staff event stream for a branch. The backend emits SSE
 * messages on service-request and order changes; we just use them as a signal
 * to refetch, which keeps the client simple and always consistent with the DB.
 */
export function useBranchEvents(branchId: string | null, onEvent: () => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!branchId) return;
    const source = new EventSource(api.eventsUrl(branchId), { withCredentials: true });
    source.onmessage = () => handlerRef.current();
    source.onerror = () => {
      // EventSource auto-reconnects; nothing to do but avoid noisy logs.
    };
    return () => source.close();
  }, [branchId]);
}
