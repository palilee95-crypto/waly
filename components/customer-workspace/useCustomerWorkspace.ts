import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchWorkspace,
  WorkspaceSnapshot,
  WorkspacePeriod,
} from '@/lib/customer-workspace';
import { cachedFetch } from '@/lib/data-cache';

type State = {
  snapshot: WorkspaceSnapshot | null;
  loading: boolean;
  error: string | null;
};

const TTL_MS = 30_000;

/**
 * Loads the workspace snapshot for a branch + period.
 *
 * Filter changes cancel by monotonic request id: a slower earlier response can never
 * overwrite the newer one. Results are cached per scope so flipping between Overview
 * and Reports does not refetch.
 */
export function useCustomerWorkspace(branchId: string, period: WorkspacePeriod) {
  const [state, setState] = useState<State>({ snapshot: null, loading: true, error: null });
  const requestId = useRef(0);

  // v2: the v1 entries predate the report aggregates and have no `sales` block.
  const key = `workspace:v3:${branchId}:${period.id}:${period.from}:${period.to}`;

  const load = useCallback(
    async (force = false) => {
      const id = ++requestId.current;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const snapshot = await cachedFetch(
          key,
          () => fetchWorkspace({ branchId, periodId: period.id, from: period.from, to: period.to }),
          { ttl: TTL_MS, force }
        );
        if (id !== requestId.current) return; // a newer filter change won
        setState({ snapshot, loading: false, error: null });
      } catch (err: any) {
        if (id !== requestId.current) return;
        const message =
          err?.status === 403
            ? 'You do not have access to this store.'
            : err?.status === 401
              ? 'Your session expired. Please sign in again.'
              : 'Could not load customer metrics.';
        // Never fall back to demo numbers.
        setState({ snapshot: null, loading: false, error: message });
      }
    },
    [key, branchId, period.from, period.to]
  );

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, retry: () => load(true) };
}
