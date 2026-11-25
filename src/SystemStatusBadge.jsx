import React, { useState, useEffect } from 'react';
import insforge from './insforge';
import env from './env';

/**
 * SystemStatusBadge
 * Checks live connectivity with the InsForge backend and displays connection status.
 */
export function SystemStatusBadge() {
  const [status, setStatus] = useState('checking'); // 'connected' | 'error' | 'checking'
  const [latency, setLatency] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      const startTime = performance.now();
      try {
        // Ping InsForge via getCurrentUser()
        const { error } = await insforge.auth.getCurrentUser();
        const duration = Math.round(performance.now() - startTime);

        if (isMounted) {
          if (!error) {
            setStatus('connected');
            setLatency(duration);
          } else {
            // Even if unauthenticated, the response means the backend is reachable
            setStatus('connected');
            setLatency(duration);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend ping failed:', err);
          setStatus('error');
        }
      }
    }

    void checkHealth();
    const interval = setInterval(checkHealth, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className={`status-badge ${status}`}
      title={`InsForge Host: ${env.insforgeUrl}${latency ? ` (${latency}ms)` : ''}`}
    >
      <span className={`status-dot ${status === 'connected' ? 'pulse' : ''}`} />
      <span>
        {status === 'connected'
          ? `InsForge Live (${latency ? `${latency}ms` : 'OK'})`
          : status === 'checking'
          ? 'Connecting...'
          : 'Backend Offline'}
      </span>
    </div>
  );
}

export default SystemStatusBadge;
