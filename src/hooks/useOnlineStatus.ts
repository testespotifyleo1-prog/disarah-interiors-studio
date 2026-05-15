import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ConnectionStatus = 'online' | 'offline' | 'checking';

export function useOnlineStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(navigator.onLine ? 'online' : 'offline');
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus('offline');
      return false;
    }
    try {
      // Lightweight check: just hit supabase health
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const { error } = await supabase.from('accounts').select('id').limit(1).abortSignal(controller.signal);
      clearTimeout(timeout);
      if (error && error.message?.includes('abort')) {
        setStatus('offline');
        return false;
      }
      setStatus(error ? 'offline' : 'online');
      return !error;
    } catch {
      setStatus('offline');
      return false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setStatus('checking');
      checkConnection();
    };
    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check every 30s
    checkTimerRef.current = setInterval(() => {
      if (navigator.onLine) checkConnection();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (checkTimerRef.current) clearInterval(checkTimerRef.current);
    };
  }, [checkConnection]);

  return { isOnline: status === 'online', status, checkConnection };
}
