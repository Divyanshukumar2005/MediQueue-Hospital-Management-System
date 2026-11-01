import { useCallback, useEffect, useRef, useState } from 'react';
import { getQueueStatus, subscribeToQueue } from '../services/api';

/**
 * Live queue board data.
 *  - loads once on mount
 *  - re-loads instantly when Supabase Realtime says a queue changed
 *  - falls back to polling every `pollMs` (default 30 s) in case the websocket drops
 * Returns { queues, loading, error, lastUpdated, refresh }.
 */
export default function useQueueStatus({ pollMs = 30000 } = {}) {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const alive = useRef(true);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getQueueStatus();
      if (!alive.current) return;
      setQueues(data || []);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    refresh();
    // many token updates can arrive in a burst → coalesce into one fetch
    const unsubscribe = subscribeToQueue(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(refresh, 250);
    });
    const poll = pollMs ? setInterval(refresh, pollMs) : null;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      if (poll) clearInterval(poll);
      unsubscribe();
    };
  }, [refresh, pollMs]);

  return { queues, loading, error, lastUpdated, refresh };
}
