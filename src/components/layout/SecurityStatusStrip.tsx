import { useEffect, useState } from 'react';

export interface HealthState {
  ok: boolean;
  mode: 'mongodb' | 'ephemeral-memory';
  databaseConnected: boolean;
  ttlIndexVerified: boolean;
  ttlSeconds: number;
  geminiConfigured: boolean;
}

export function SecurityStatusStrip() {
  const [health, setHealth] = useState<HealthState | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setHealth(data as HealthState);
      })
      .catch(() => {
        if (active) setHealth(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const dbLabel = !health
    ? 'CHECKING...'
    : health.databaseConnected && health.ttlIndexVerified
      ? `TTL ENABLED (${health.ttlSeconds}s)`
      : health.databaseConnected
        ? 'MONGODB CONNECTED (TTL UNVERIFIED)'
        : 'MONGODB DISCONNECTED (SESSION MEMORY)';

  return (
    <footer
      aria-label="Verifiable Security and Processing Guarantees"
      className="border-t border-[#08090B]/10 bg-white/80 px-4 sm:px-6 py-3 font-mono text-[10px] sm:text-[11px] text-[#525866]"
    >
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span>
            <strong className="text-[#08090B]">PROCESSING:</strong> ON DEVICE
          </span>
          <span>
            <strong className="text-[#08090B]">ORIGINAL FILE STORAGE:</strong> NONE
          </span>
          <span>
            <strong className="text-[#08090B]">SAVED REPORT ACCESS:</strong> EXPIRES AFTER 2H
          </span>
          <span>
            <strong className="text-[#08090B]">VALIDATION:</strong> ZOD
          </span>
        </div>

        <div>
          <span>
            <strong className="text-[#08090B]">DATABASE CLEANUP:</strong>{' '}
            <span
              className={
                health?.databaseConnected && health?.ttlIndexVerified
                  ? 'text-[#0F766E] font-semibold'
                  : 'text-[#B45309] font-semibold'
              }
            >
              {dbLabel}
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
