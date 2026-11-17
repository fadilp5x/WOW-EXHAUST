import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ExternalLink, Globe, MapPin, ShieldCheck } from 'lucide-react';
import type { GpsCoordinates } from '../../types/forensics';

interface EvidenceLocationPanelProps {
  gps: GpsCoordinates | null;
  hasFile: boolean;
  hasNoExifMessage?: boolean;
  enlarged?: boolean;
}

interface ReverseGeoResult {
  areaLabel: string | null;
  country: string | null;
  provider: string;
}

function formatCoord(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

export function EvidenceLocationPanel({
  gps,
  hasFile,
  hasNoExifMessage = false,
  enlarged = false,
}: EvidenceLocationPanelProps) {
  const [tilesConsented, setTilesConsented] = useState(false);
  const [reverseGeo, setReverseGeo] = useState<ReverseGeoResult | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    setTilesConsented(false);
    setReverseGeo(null);
  }, [gps?.latitude, gps?.longitude]);

  useEffect(() => {
    if (!tilesConsented || !gps || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    let active = true;
    fetch(
      `/api/location/reverse?lat=${encodeURIComponent(gps.latitude.toFixed(5))}&lon=${encodeURIComponent(gps.longitude.toFixed(5))}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) {
          setReverseGeo(data as ReverseGeoResult);
        }
      })
      .catch(() => {
        // Optional lookup failure does not block map tiles
      });

    const map = L.map(mapContainerRef.current, {
      center: [gps.latitude, gps.longitude],
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('/api/location/tile/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const pulseIcon = L.divIcon({
      className: 'exhaust-gps-marker',
      html: `
        <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
          <span class="exhaust-gps-pulse" style="position:absolute;inset:0;border-radius:9999px;background:rgba(255,75,75,0.45);"></span>
          <span style="width:10px;height:10px;border-radius:9999px;background:#FF4B4B;border:2px solid #FAF8F3;"></span>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    L.marker([gps.latitude, gps.longitude], { icon: pulseIcon })
      .addTo(map)
      .bindPopup(
        `<div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#08090B;">EXIF GPS<br/>${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}</div>`
      );

    mapInstanceRef.current = map;

    return () => {
      active = false;
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [gps, tilesConsented]);

  return (
    <section
      aria-label="LOCATION"
      className="bg-[#FAF8F3]/80 border border-[#08090B]/8 rounded-2xl p-3.5 flex flex-col gap-2.5 h-full justify-between"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-bold text-[#08090B] flex items-center gap-1.5">
          <MapPin className={`w-3.5 h-3.5 ${gps ? 'text-[#FF4B4B]' : 'text-[#00545F]'}`} />
          <span>Location</span>
          <span className="font-sans font-normal text-[#525866]">(GPS)</span>
        </h3>
        {gps ? (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#FFE5E5] text-[#B91C1C] font-bold">
            GPS FOUND
          </span>
        ) : hasFile ? (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#ECFFB6] text-[#08090B] font-bold inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#0F766E]" />
            CLEAN
          </span>
        ) : null}
      </div>

      {!hasFile ? (
        <div className="rounded-2xl border border-dashed border-[#08090B]/15 bg-white p-4 text-center flex-1 flex items-center justify-center">
          <p className="font-mono text-[11px] text-[#525866]">
            Scan an image to inspect embedded GPS IFD coordinates.
          </p>
        </div>
      ) : !gps ? (
        <div className="rounded-2xl border border-[#12A36B]/30 bg-white p-3.5 space-y-1 flex-1 flex flex-col justify-center">
          <p className="font-mono text-xs font-bold text-[#0F766E]">
            NO LOCATION METADATA FOUND
          </p>
          <p className="font-sans text-[11px] text-[#525866] leading-snug">
            {hasNoExifMessage
              ? 'This file contains no GPS coordinates. Many messengers strip EXIF on upload, though originals still hold them.'
              : 'No GPS latitude/longitude coordinates are present in this input.'}
          </p>
        </div>
      ) : !tilesConsented ? (
        <div className="relative rounded-2xl overflow-hidden bg-[#08090B] border border-[#08090B] p-3.5 text-white flex flex-col justify-between min-h-[132px]">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 50% 42%, rgba(255,75,75,0.45), transparent 55%), linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
              backgroundSize: '100% 100%, 24px 24px, 24px 24px',
            }}
          />

          <div className="relative z-10 flex items-center justify-center py-2">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <span className="exhaust-gps-pulse absolute inset-0 rounded-full bg-[#FF4B4B]/40" />
              <span className="w-7 h-7 rounded-full bg-[#FF4B4B]/25 border border-[#FF4B4B] flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-[#FF4B4B]" />
              </span>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-2">
            <span className="font-mono text-[11px] font-bold text-white tabular-nums">
              {formatCoord(gps.latitude, gps.longitude)}
            </span>
            <button
              type="button"
              onClick={() => setTilesConsented(true)}
              title="Loads map tiles and OpenStreetMap area lookup via EXHAUST server proxy only after click"
              className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-[#CDF22B] hover:text-[#08090B] text-white font-mono text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Globe className="w-3 h-3" />
              <span>Load Map</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div
            ref={mapContainerRef}
            className={`w-full rounded-2xl overflow-hidden border border-[#08090B]/20 ${
              enlarged ? 'h-56' : 'h-36'
            }`}
            data-testid="evidence-leaflet-map"
          />
          <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-[10px] text-[#525866] px-1">
            <span className="tabular-nums">{formatCoord(gps.latitude, gps.longitude)}</span>
            <span className="text-[#00545F] truncate max-w-[170px]" title={reverseGeo?.areaLabel ?? undefined}>
              {reverseGeo?.areaLabel ? reverseGeo.areaLabel : 'OSM Proxy Active'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
