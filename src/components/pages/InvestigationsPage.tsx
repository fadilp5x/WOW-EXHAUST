import { FolderClock, RefreshCw, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import type { SavedScanSummary } from '../../types/forensics';
import type { HealthState } from '../layout/SecurityStatusStrip';

interface InvestigationsPageProps {
  savedReports: SavedScanSummary[];
  loadingReports: boolean;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onReturnToScanner: () => void;
  healthDetails: HealthState | null;
  onReplayExperience: () => void;
  onViewWall: () => void;
}

export function InvestigationsPage({
  savedReports,
  loadingReports,
  onRefresh,
  onDelete,
  onReturnToScanner,
  healthDetails,
  onReplayExperience,
  onViewWall,
}: InvestigationsPageProps) {
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Saved Summaries */}
      <section className="card-unseen p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#08090B]/10 pb-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-[#00545F] font-semibold">
              Session-Isolated Archive
            </span>
            <h1 className="font-display text-3xl font-bold text-[#08090B] mt-0.5 flex items-center gap-2">
              <FolderClock className="w-6 h-6 text-[#00545F]" />
              Saved Report Summaries (2-Hour TTL)
            </h1>
            <p className="font-sans text-xs sm:text-sm text-[#525866] mt-1">
              Minimized score and field presence summaries only. Original files and raw GPS coordinates are never stored on the server.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="btn-tactile-secondary px-4 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={onReturnToScanner}
              className="btn-tactile-lime px-4 py-2 text-xs cursor-pointer"
            >
              Back to Scanner
            </button>
          </div>
        </div>

        {loadingReports ? (
          <p className="font-mono text-xs text-[#525866]">Loading summaries...</p>
        ) : savedReports.length === 0 ? (
          <div className="border-2 border-dashed border-[#08090B]/15 bg-[#FAF8F3] rounded-2xl p-8 text-center space-y-3">
            <p className="font-mono text-xs text-[#525866]">
              No saved report summaries in this browser session yet. Run a scan and click &ldquo;Save (2h TTL)&rdquo; to archive a minimized summary.
            </p>
            <button
              type="button"
              onClick={onReturnToScanner}
              className="btn-tactile-dark px-5 py-2.5 text-xs cursor-pointer"
            >
              Open X-Ray Scanner
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedReports.map((item) => (
              <div
                key={item.id}
                className="bg-[#FAF8F3] border border-[#08090B]/10 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-[#ECFFB6] font-mono text-[10px] font-bold uppercase text-[#08090B]">
                      {item.fileType}
                    </span>
                    <span className="font-display text-base font-bold text-[#08090B] tabular-nums">
                      Score {item.riskScore}/100 ({item.band})
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-[#525866]">
                    Created {new Date(item.createdAt).toLocaleTimeString()} · Expires{' '}
                    {new Date(item.expiresAt).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  aria-label={`Delete saved report ${item.id}`}
                  className="px-3 py-2 rounded-xl border border-[#FF4B4B]/40 text-[#FF4B4B] hover:bg-[#FF4B4B] hover:text-white font-mono text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Diagnostics & Privacy Disclosures */}
      <section className="card-unseen p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2 border-b border-[#08090B]/10 pb-3">
          <ShieldCheck className="w-5 h-5 text-[#0F766E]" />
          <h2 className="font-display text-2xl font-bold text-[#08090B]">
            System Diagnostics & Privacy Disclosures
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-[#FAF8F3] border border-[#08090B]/10 rounded-2xl p-4 space-y-1">
            <span className="text-[10px] text-[#525866] uppercase block">Database Engine</span>
            <p className="text-[#08090B] font-semibold">
              {healthDetails?.databaseConnected
                ? 'MongoDB Atlas Connected (db: exhaust)'
                : 'Ephemeral Server Memory'}
            </p>
          </div>
          <div className="bg-[#FAF8F3] border border-[#08090B]/10 rounded-2xl p-4 space-y-1">
            <span className="text-[10px] text-[#525866] uppercase block">TTL Index</span>
            <p
              className={
                healthDetails?.ttlIndexVerified
                  ? 'text-[#0F766E] font-semibold'
                  : 'text-[#B45309] font-semibold'
              }
            >
              {healthDetails?.ttlIndexVerified
                ? `Verified createdAt TTL (${healthDetails.ttlSeconds}s)`
                : 'App-level 2h expiry active'}
            </p>
          </div>
          <div className="bg-[#FAF8F3] border border-[#08090B]/10 rounded-2xl p-4 space-y-1">
            <span className="text-[10px] text-[#525866] uppercase block">Gemini AI Layer</span>
            <p className="text-[#08090B] font-semibold">
              {healthDetails?.geminiConfigured
                ? 'Server API Ready (Consent-Only)'
                : 'Deterministic Fallback Mode'}
            </p>
          </div>
          <div className="bg-[#FAF8F3] border border-[#08090B]/10 rounded-2xl p-4 space-y-2">
            <span className="text-[10px] text-[#525866] uppercase block">Experience Replay</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={onReplayExperience}
                className="btn-tactile-lime px-2.5 py-1 text-[10px] inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Act I Intro
              </button>
              <button
                type="button"
                onClick={onViewWall}
                className="btn-tactile-secondary px-2.5 py-1 text-[10px] cursor-pointer"
              >
                Act II Wall
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#FAF8F3] border border-[#08090B]/10 rounded-2xl p-4 space-y-1.5 font-sans text-xs text-[#525866]">
          <p>
            <strong className="text-[#08090B]">1. Local Device Processing:</strong> Image EXIF parsing, PDF Info scanning, text pattern analysis, canvas pixel redaction, and metadata scrubbing execute locally inside your browser. Original files never leave your device.
          </p>
          <p>
            <strong className="text-[#08090B]">2. Saved Summaries (2-Hour TTL):</strong> Saving writes only minimized boolean findings and risk scores to MongoDB Atlas with a 7,200-second automatic expiration index.
          </p>
          <p>
            <strong className="text-[#08090B]">3. Optional Consented AI Services:</strong> Clicking &ldquo;Explain This Finding&rdquo; sends only minimized finding labels (never raw GPS coordinates or original file bytes). AI visual inspection sends a resized image strictly after explicit confirmation.
          </p>
        </div>
      </section>
    </main>
  );
}
