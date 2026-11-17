import { useState } from 'react';
import { Globe, Network, Search } from 'lucide-react';
import type { AnyScanReport, WebsiteSummaryReport } from '../../types/forensics';

interface WebsiteAndOsintSummaryProps {
  report: AnyScanReport | null;
}

export function WebsiteAndOsintSummary({ report }: WebsiteAndOsintSummaryProps) {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [webSummary, setWebSummary] = useState<WebsiteSummaryReport | null>(null);

  const handleInspectUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setWebError(null);
    if (!urlInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/website/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWebError(data.error || 'Website summary request failed.');
        setWebSummary(null);
      } else {
        setWebSummary(data as WebsiteSummaryReport);
      }
    } catch {
      setWebError('Network error while contacting website summary endpoint.');
    } finally {
      setLoading(false);
    }
  };

  const presentFindings = report ? report.findings.filter((f) => f.present) : [];

  return (
    <div className="space-y-4">
      <section className="card-unseen p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono text-xs tracking-[0.14em] text-[#08090B] font-bold uppercase flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#00545F]" />
            WEBSITE EXPOSURE SUMMARY
          </h3>
          <span className="font-mono text-[10px] text-[#525866]">
            PASSIVE PUBLIC HEADERS
          </span>
        </div>

        <form onSubmit={handleInspectUrl} className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.org"
            aria-label="Public HTTPS URL for passive header summary"
            className="flex-1 bg-[#FAF8F3] border border-[#08090B]/15 rounded-xl px-3 py-2 font-mono text-xs text-[#08090B] focus:border-[#08090B] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-tactile-dark px-4 py-2 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Search className="w-3.5 h-3.5 text-[#CDF22B]" />
            <span>{loading ? 'Inspecting...' : 'Inspect Summary'}</span>
          </button>
        </form>

        {webError && (
          <p role="alert" className="font-mono text-xs text-[#FF4B4B]">
            {webError}
          </p>
        )}

        {webSummary && (
          <div className="rounded-2xl border border-[#08090B]/10 bg-[#FAF8F3] p-3.5 space-y-2 font-mono text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[#08090B] font-bold truncate">
                {webSummary.pageTitle || webSummary.finalUrl}
              </span>
              <span className="text-[#0F766E] font-bold">
                HTTP {webSummary.statusCode} · {webSummary.httpsAvailable ? 'HTTPS' : 'HTTP'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              {Object.entries(webSummary.securityHeaders).map(([hdr, val]) => (
                <div key={hdr} className="rounded-xl bg-white border border-[#08090B]/8 p-2">
                  <span className="text-[9px] text-[#525866] block uppercase">{hdr}</span>
                  <span className={val ? 'text-[#0F766E] font-bold' : 'text-[#B45309] font-bold'}>
                    {val ? 'PRESENT' : 'ABSENT'}
                  </span>
                </div>
              ))}
            </div>
            {webSummary.thirdPartyHosts.length > 0 && (
              <p className="text-[11px] text-[#525866]">
                Third-party hosts observed: {webSummary.thirdPartyHosts.join(', ')}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="card-unseen p-4 sm:p-5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono text-xs tracking-[0.14em] text-[#08090B] font-bold uppercase flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5 text-[#00545F]" />
            OSINT PROVENANCE SUMMARY
          </h3>
          <span className="font-mono text-[10px] text-[#525866]">EVIDENCE-BOUNDED</span>
        </div>

        {!report ? (
          <p className="font-sans text-xs text-[#525866]">
            Scan a file or inspect a public URL above to assemble provenance-backed entity observations.
          </p>
        ) : (
          <div className="rounded-2xl border border-[#08090B]/10 bg-[#FAF8F3] p-3.5 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-[#525866]">
              <span>ACTIVE EVIDENCE SOURCE</span>
              <span className="text-[#08090B] font-semibold">
                {report.kind === 'text' ? report.sourceLabel : report.fileName}
              </span>
            </div>
            <div className="space-y-1">
              {presentFindings.length === 0 ? (
                <p className="text-[#0F766E] font-bold text-[11px]">
                  No exposed metadata provenance entities in active file.
                </p>
              ) : (
                presentFindings.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 border-t border-[#08090B]/8 pt-1 text-[11px]"
                  >
                    <span className="text-[#08090B] truncate">{f.label}</span>
                    <span className="text-[#00545F] font-semibold shrink-0">{f.sourceTag}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
