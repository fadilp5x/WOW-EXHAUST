import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Database,
  Download,
  FileSearch,
  FolderClock,
  Layers,
  MapPin,
  Network,
  Save,
  Scan,
  Search,
  Share2,
  Sparkles,
  User,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  AnyScanReport,
  Deduction,
  DefenderActionTarget,
  ProofOfScrub,
  SavedScanSummary,
  ScanStageEntry,
  ScanStatus,
  TimelineEvent,
  VisualInspectionResponse,
  VisualObservation,
} from '../../types/forensics';
import { analyzeImageFile } from '../../lib/imageForensics';
import { analyzePdfFile } from '../../lib/pdfForensics';
import { analyzeText } from '../../lib/textFingerprint';
import {
  buildDeterministicDeductions,
  buildMinimizedFindings,
} from '../../lib/deductions';
import {
  createSampleDevicePhoto,
  createSampleGpsPhoto,
  createSampleResumePdf,
  SAMPLE_TEXT_POST,
} from '../../lib/samples';
import {
  createInitialImageStages,
  createInitialPdfStages,
  createInitialTextStages,
} from '../../lib/scanStages';
import { getRiskThemeForReport } from '../../lib/riskTheme';
import { ExposureGauge } from '../gauge/ExposureGauge';
import { EvidenceLocationPanel } from '../map/EvidenceLocationPanel';
import { ProfilerFeed } from '../redteam/ProfilerFeed';
import { DropzoneTerminal, type ScanInputMode } from '../scanner/DropzoneTerminal';
import { InvisibleLayerAndFindings } from '../reports/InvisibleLayerAndFindings';
import { ScrubberPanel } from '../scrubber/ScrubberPanel';
import { EvidenceGraphPanel } from '../reports/EvidenceGraphPanel';
import { WebsiteAndOsintSummary } from '../scanner/WebsiteAndOsintSummary';
import { CurrentInputPanel } from '../preview/CurrentInputPanel';
import { VisualInspectionPanel } from '../scanner/VisualInspectionPanel';
import { TopNavBar, type UnseenRoute } from '../layout/TopNavBar';
import {
  SecurityStatusStrip,
  type HealthState,
} from '../layout/SecurityStatusStrip';
import { ToolsPage } from '../pages/ToolsPage';
import { ImpactPage } from '../pages/ImpactPage';
import { AboutPage } from '../pages/AboutPage';
import { InvestigationsPage } from '../pages/InvestigationsPage';
import { ContactPage } from '../pages/ContactPage';

type CenterTab = 'findings' | 'scrubber' | 'graph' | 'surface';

interface MachineShellProps {
  initialSample?: 'gps' | 'pdf' | 'text' | null;
  onConsumeInitialSample?: () => void;
  onReplayExperience: () => void;
  onViewWall: () => void;
}

const STAGE_DELAY_MS = 55;

function parseRouteFromPathname(): UnseenRoute {
  if (typeof window === 'undefined') return '/';
  const p = window.location.pathname.toLowerCase();
  if (p.startsWith('/investigations')) return '/investigations';
  if (p.startsWith('/tools')) return '/tools';
  if (p.startsWith('/impact')) return '/impact';
  if (p.startsWith('/about')) return '/about';
  if (p.startsWith('/contact')) return '/contact';
  return '/';
}

export function MachineShell({
  initialSample,
  onConsumeInitialSample,
  onReplayExperience,
  onViewWall,
}: MachineShellProps) {
  const [route, setRoute] = useState<UnseenRoute>(parseRouteFromPathname);
  const [centerTab, setCenterTab] = useState<CenterTab>('findings');
  const [showFullFindings, setShowFullFindings] = useState(false);
  const [judgeMode, setJudgeMode] = useState(false);
  const [redteamMode, setRedteamMode] = useState(false);

  // Authoritative single-source scan & input state
  const [inputMode, setInputMode] = useState<ScanInputMode>('file');
  const [textDraft, setTextDraft] = useState('');
  const [activeInputType, setActiveInputType] = useState<'image' | 'pdf' | 'text' | null>(null);
  const [activeSource, setActiveSource] = useState<'sample' | 'user' | null>(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [activeFormatLabel, setActiveFormatLabel] = useState('');
  const [activeSizeBytes, setActiveSizeBytes] = useState<number | undefined>(undefined);
  const [activeDimensions, setActiveDimensions] = useState<{ width: number; height: number } | null>(null);
  const [activePageCount, setActivePageCount] = useState<number | undefined>(undefined);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [activePdfBytes, setActivePdfBytes] = useState<Uint8Array | null>(null);

  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanStageLabel, setScanStageLabel] = useState('IDLE');
  const [stages, setStages] = useState<ScanStageEntry[]>([]);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [revealLimit, setRevealLimit] = useState<number>(999);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [report, setReport] = useState<AnyScanReport | null>(null);
  const [proof, setProof] = useState<ProofOfScrub | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [highlightedFindingId, setHighlightedFindingId] = useState<string | null>(null);

  const [visualInspection, setVisualInspection] = useState<VisualInspectionResponse | null>(null);
  const [highlightedVisualObs, setHighlightedVisualObs] = useState<VisualObservation | null>(null);

  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [deductionProvider, setDeductionProvider] = useState<
    'deterministic' | 'gemini' | 'deterministic-fallback'
  >('deterministic');
  const [deductionNote, setDeductionNote] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const [savedReports, setSavedReports] = useState<SavedScanSummary[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [healthDetails, setHealthDetails] = useState<HealthState | null>(null);

  const activeScanIdRef = useRef<string | null>(null);
  const scanRunTokenRef = useRef<number>(0);
  const previewUrlRef = useRef<string | null>(null);

  const navigate = useCallback((nextRoute: UnseenRoute) => {
    setRoute(nextRoute);
    if (typeof window !== 'undefined' && window.location.pathname !== nextRoute) {
      window.history.pushState({}, '', nextRoute);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromPathname());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const revokeActivePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setActivePreviewUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const appendEvent = useCallback(
    (stage: TimelineEvent['stage'], label: string, detail: string) => {
      setTimeline((prev) => [
        ...prev,
        {
          id: `${stage}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          stage,
          label,
          detail,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    []
  );

  const clearScanResultsOnly = useCallback((nextStatus: ScanStatus = 'idle') => {
    activeScanIdRef.current = null;
    setIsEnhancing(false);
    setReport(null);
    setProof(null);
    setTimeline([]);
    setHighlightedFindingId(null);
    setVisualInspection(null);
    setHighlightedVisualObs(null);
    setDeductions([]);
    setDeductionProvider('deterministic');
    setDeductionNote(null);
    setStages([]);
    setTerminalLines([]);
    setScanStageLabel('IDLE');
    setRevealLimit(999);
    setScanStatus(nextStatus);
    setShowFullFindings(false);
  }, []);

  const clearAllInputAndState = useCallback(() => {
    scanRunTokenRef.current += 1;
    revokeActivePreviewUrl();
    setSourceFile(null);
    setActivePdfBytes(null);
    setActiveInputType(null);
    setActiveSource(null);
    setActiveTitle('');
    setActiveFormatLabel('');
    setActiveSizeBytes(undefined);
    setActiveDimensions(null);
    setActivePageCount(undefined);
    setTextDraft('');
    clearScanResultsOnly('idle');
  }, [clearScanResultsOnly, revokeActivePreviewUrl]);

  const fetchSavedReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/scans');
      if (res.ok) {
        const data = (await res.json()) as { scans: SavedScanSummary[] };
        setSavedReports(data.scans ?? []);
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    if (route === '/investigations') {
      void fetchSavedReports();
      fetch('/api/health')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setHealthDetails(d as HealthState))
        .catch(() => {});
    }
  }, [fetchSavedReports, route]);

  const delayStep = (ms: number, runToken: number) =>
    new Promise<boolean>((resolve) => {
      window.setTimeout(() => {
        resolve(scanRunTokenRef.current === runToken);
      }, ms);
    });

  const handleScanFile = useCallback(
    async (
      file: File,
      opts?: { isSample?: boolean; sampleLabel?: string }
    ) => {
      const runToken = ++scanRunTokenRef.current;
      const lower = file.name.toLowerCase();
      const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
      const isSample = Boolean(opts?.isSample);

      revokeActivePreviewUrl();
      setActivePdfBytes(null);
      setActiveDimensions(null);
      setActivePageCount(undefined);
      clearScanResultsOnly('processing');

      setInputMode('file');
      navigate('/');
      setCenterTab('findings');
      setSourceFile(file);
      setActiveInputType(isPdf ? 'pdf' : 'image');
      setActiveSource(isSample ? 'sample' : 'user');
      setActiveTitle(file.name);
      setActiveFormatLabel(
        isPdf
          ? 'PDF Document'
          : (file.type || 'image/jpeg').replace('image/', '').toUpperCase()
      );
      setActiveSizeBytes(file.size);

      const initialStages = isPdf
        ? createInitialPdfStages()
        : createInitialImageStages();
      setStages(initialStages);

      const setStageStatus = (
        id: string,
        status: ScanStageEntry['status'],
        detail?: string
      ) => {
        if (scanRunTokenRef.current !== runToken) return;
        setStages((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status, detail } : s))
        );
      };

      const log = (line: string, stageLabel: string) => {
        if (scanRunTokenRef.current !== runToken) return;
        setScanStageLabel(stageLabel);
        setTerminalLines((prev) => [...prev, line]);
      };

      try {
        let pdfBuffer: Uint8Array | null = null;
        if (isPdf) {
          pdfBuffer = new Uint8Array(await file.arrayBuffer());
          if (scanRunTokenRef.current !== runToken) return;
          setActivePdfBytes(pdfBuffer);
        } else {
          const preview = URL.createObjectURL(file);
          previewUrlRef.current = preview;
          setActivePreviewUrl(preview);
          try {
            const bmp = await createImageBitmap(file);
            if (scanRunTokenRef.current === runToken) {
              setActiveDimensions({ width: bmp.width, height: bmp.height });
            }
            bmp.close();
          } catch {
            // Optional dimensions fallback handled by imageForensics
          }
        }

        if (isPdf) {
          setStageStatus('open', 'active');
          log(`> OPENING DOCUMENT: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'OPENING');
          appendEvent('load', 'Document loaded', file.name);
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('open', 'done');

          setStageStatus('structure', 'active');
          log('> READING PDF TRAILER & %%EOF STRUCTURE', 'STRUCTURE');
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('structure', 'done');

          setStageStatus('metadata', 'active');
          log('> PARSING DOCUMENT INFO DICTIONARY & PROPERTIES', 'METADATA');
          const nextReport = await analyzePdfFile(file, opts);
          if (scanRunTokenRef.current !== runToken) return;

          setActivePageCount(nextReport.pageCount);
          const hasInfo = nextReport.findings.some((f) => f.present);
          setStageStatus('metadata', hasInfo ? 'done' : 'not_present');

          setStageStatus('properties', 'active');
          const hasStructural =
            nextReport.structuralFlags.hasEmbeddedFiles ||
            nextReport.structuralFlags.hasAnnotations ||
            nextReport.structuralFlags.hasFormFields ||
            nextReport.structuralFlags.hasDigitalSignatures;
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('properties', hasStructural ? 'done' : 'not_present');

          setStageStatus('score', 'active');
          activeScanIdRef.current = nextReport.id;
          setReport(nextReport);
          appendEvent(
            'parse',
            'PDF properties parsed',
            `${nextReport.findings.filter((f) => f.present).length} present field(s)`
          );
          appendEvent(
            'score',
            'Exposure evaluated',
            `${nextReport.risk.score}/100 (${nextReport.risk.band})`
          );
          log(`> PRIVACY EXPOSURE SCORED: ${nextReport.risk.score}/100 (${nextReport.risk.band})`, 'SCORING');
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('score', 'done');

          setStageStatus('findings', 'active');
          setDeductions(buildDeterministicDeductions(nextReport));
          setScanStatus('revealing');
          setRevealLimit(3);
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('findings', 'done');

          setStageStatus('remediation', 'active');
          setRevealLimit(999);
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('remediation', 'done');

          setScanStatus('complete');
          log('> INVESTIGATION COMPLETE', 'COMPLETE');
        } else {
          setStageStatus('receive', 'active');
          log(`> RECEIVING LOCAL INPUT: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'RECEIVE');
          appendEvent('load', 'Image loaded', file.name);
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('receive', 'done');

          setStageStatus('validate', 'active');
          log('> VALIDATING IMAGE CONTAINER', 'VALIDATE');
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('validate', 'done');

          setStageStatus('bytes', 'active');
          log('> READING FILE BYTES & DIMENSIONS IN MEMORY', 'BYTES');
          const nextReport = await analyzeImageFile(file, opts);
          if (scanRunTokenRef.current !== runToken) return;
          if (nextReport.width && nextReport.height) {
            setActiveDimensions({ width: nextReport.width, height: nextReport.height });
          }
          setStageStatus('bytes', 'done');

          setStageStatus('exif', 'active');
          const anyExifPresent = nextReport.findings.some((f) => f.present);
          log(
            anyExifPresent
              ? `> EXTRACTED ${nextReport.findings.filter((f) => f.present).length} EMBEDDED EXIF/XMP FIELD(S)`
              : '> NO EMBEDDED EXIF/XMP FIELDS PRESENT',
            'EXIF'
          );
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('exif', anyExifPresent ? 'done' : 'not_present');

          setStageStatus('location', 'active');
          if (nextReport.gps) {
            log(
              `> GPS METADATA DETECTED (${nextReport.gps.latitude.toFixed(5)}, ${nextReport.gps.longitude.toFixed(5)})`,
              'LOCATION'
            );
            setStageStatus('location', 'done', 'GPS');
          } else {
            log('> LOCATION FIELDS NOT PRESENT', 'LOCATION');
            setStageStatus('location', 'not_present');
          }
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;

          setStageStatus('device', 'active');
          const hasDevice = nextReport.findings.some(
            (f) => f.category === 'DEVICE' && f.present
          );
          setStageStatus('device', hasDevice ? 'done' : 'not_present');
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;

          setStageStatus('score', 'active');
          activeScanIdRef.current = nextReport.id;
          if (previewUrlRef.current && nextReport.previewUrl) {
            URL.revokeObjectURL(nextReport.previewUrl);
            nextReport.previewUrl = previewUrlRef.current;
          }
          setReport(nextReport);
          appendEvent(
            'parse',
            'Metadata parsed',
            `${nextReport.findings.filter((f) => f.present).length} exposed field(s)`
          );
          appendEvent(
            'score',
            'Exposure calculated',
            `${nextReport.risk.score}/100 (${nextReport.risk.band})`
          );
          log(`> EXPOSURE SCORED: ${nextReport.risk.score}/100 (${nextReport.risk.band})`, 'SCORING');
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('score', 'done');

          setStageStatus('graph', 'active');
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('graph', 'done');

          setStageStatus('defender', 'active');
          setDeductions(buildDeterministicDeductions(nextReport));
          setScanStatus('revealing');
          setRevealLimit(3);
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('defender', 'done');

          setStageStatus('finalize', 'active');
          setRevealLimit(999);
          if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
          setStageStatus('finalize', 'done');

          setScanStatus('complete');
          log('> INVESTIGATION COMPLETE', 'COMPLETE');
        }
      } catch (err) {
        if (scanRunTokenRef.current !== runToken) return;
        setScanStatus('error');
        setScanStageLabel('ERROR');
        setStages((prev) =>
          prev.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s))
        );
        log(
          `> PARSE ERROR: ${err instanceof Error ? err.message : 'Unable to parse file'}`,
          'ERROR'
        );
        toast.error('Could not parse this file locally.');
      }
    },
    [appendEvent, clearScanResultsOnly, navigate, revokeActivePreviewUrl]
  );

  const handleAnalyzeText = useCallback(
    async (
      text: string,
      opts?: { sourceLabel?: string; isSample?: boolean; sampleLabel?: string }
    ) => {
      const trimmed = text.trim();
      if (!trimmed) {
        clearScanResultsOnly('idle');
        setActiveInputType(null);
        return;
      }

      const runToken = ++scanRunTokenRef.current;
      revokeActivePreviewUrl();
      setSourceFile(null);
      setActivePdfBytes(null);
      clearScanResultsOnly('processing');

      setInputMode('text');
      setTextDraft(text);
      setActiveInputType('text');
      setActiveSource(opts?.isSample ? 'sample' : 'user');
      setActiveTitle(opts?.sourceLabel ?? 'Pasted Text Sample');
      setActiveFormatLabel('Plain Text');
      setActiveSizeBytes(text.length);
      setActiveDimensions(null);
      setActivePageCount(undefined);
      navigate('/');
      setCenterTab('findings');
      setShowFullFindings(true);

      const initialStages = createInitialTextStages();
      setStages(initialStages);

      const setStageStatus = (
        id: string,
        status: ScanStageEntry['status'],
        detail?: string
      ) => {
        if (scanRunTokenRef.current !== runToken) return;
        setStages((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status, detail } : s))
        );
      };

      const log = (line: string, stageLabel: string) => {
        if (scanRunTokenRef.current !== runToken) return;
        setScanStageLabel(stageLabel);
        setTerminalLines((prev) => [...prev, line]);
      };

      const textReport = analyzeText(text, opts);

      setStageStatus('read', 'active');
      log(`> TEXT INPUT RECEIVED (${textReport.charCount} chars)`, 'READING');
      appendEvent('load', 'Text loaded', `${textReport.charCount} characters`);
      if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
      setStageStatus('read', 'done');

      setStageStatus('segment', 'active');
      log(
        `> SEGMENTED ${textReport.metrics.wordCount} WORDS / ${textReport.metrics.sentenceCount} SENTENCES`,
        'SEGMENTING'
      );
      if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
      setStageStatus('segment', 'done');

      setStageStatus('lexical', 'active');
      log(`> LEXICAL VARIETY: ${textReport.metrics.lexicalDiversity}`, 'LEXICAL');
      if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
      setStageStatus('lexical', 'done');

      setStageStatus('punctuation', 'active');
      if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
      setStageStatus('punctuation', 'done');

      setStageStatus('variation', 'active');
      if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
      setStageStatus('variation', 'done');

      setStageStatus('distinctiveness', 'active');
      activeScanIdRef.current = textReport.id;
      setReport(textReport);
      appendEvent(
        'score',
        'Pattern distinctiveness measured',
        `${textReport.patternStrengthIndex}/100`
      );
      log(
        `> PATTERN DISTINCTIVENESS: ${textReport.patternStrengthIndex}/100 (${textReport.patternBand})`,
        'DISTINCTIVENESS'
      );
      if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
      setStageStatus('distinctiveness', 'done');

      setStageStatus('explain', 'active');
      setDeductions(buildDeterministicDeductions(textReport));
      setScanStatus('revealing');
      setRevealLimit(3);
      if (!(await delayStep(STAGE_DELAY_MS, runToken))) return;
      setRevealLimit(999);
      setStageStatus('explain', 'done');

      setScanStatus('complete');
      log('> INVESTIGATION COMPLETE', 'COMPLETE');
    },
    [appendEvent, clearScanResultsOnly, navigate, revokeActivePreviewUrl]
  );

  const handleInputModeChange = useCallback(
    (nextMode: ScanInputMode) => {
      if (nextMode === inputMode) return;
      scanRunTokenRef.current += 1;
      setInputMode(nextMode);

      if (nextMode === 'text') {
        revokeActivePreviewUrl();
        setSourceFile(null);
        setActivePdfBytes(null);
        setActiveDimensions(null);
        setActivePageCount(undefined);
        clearScanResultsOnly('idle');
        if (textDraft.trim()) {
          setActiveInputType('text');
          setActiveSource('user');
          setActiveTitle('Pasted Text Draft');
          setActiveFormatLabel('Plain Text');
          setActiveSizeBytes(textDraft.length);
          setScanStatus('ready');
        } else {
          setActiveInputType(null);
          setActiveSource(null);
          setActiveTitle('');
          setActiveFormatLabel('');
          setActiveSizeBytes(undefined);
        }
      } else {
        if (!sourceFile) {
          setActiveInputType(null);
          setActiveSource(null);
          setActiveTitle('');
          setActiveFormatLabel('');
          setActiveSizeBytes(undefined);
          clearScanResultsOnly('idle');
        }
      }
    },
    [clearScanResultsOnly, inputMode, revokeActivePreviewUrl, sourceFile, textDraft]
  );

  const handleTextInputChange = useCallback(
    (nextText: string) => {
      setTextDraft(nextText);
      if (!nextText.trim()) {
        scanRunTokenRef.current += 1;
        setActiveInputType(null);
        setActiveSource(null);
        setActiveTitle('');
        setActiveFormatLabel('');
        setActiveSizeBytes(undefined);
        clearScanResultsOnly('idle');
        return;
      }

      setActiveInputType('text');
      setActiveSource('user');
      setActiveTitle('Pasted Text Draft');
      setActiveFormatLabel('Plain Text');
      setActiveSizeBytes(nextText.length);

      if (report) {
        clearScanResultsOnly('ready');
      } else if (scanStatus === 'idle') {
        setScanStatus('ready');
      }
    },
    [clearScanResultsOnly, report, scanStatus]
  );

  const handleLoadSample = useCallback(
    async (sample: 'gps' | 'device' | 'pdf' | 'text') => {
      if (sample === 'text') {
        await handleAnalyzeText(SAMPLE_TEXT_POST, {
          sourceLabel: 'SAMPLE: Text Post',
          isSample: true,
          sampleLabel: 'SAMPLE',
        });
        return;
      }

      scanRunTokenRef.current += 1;
      clearScanResultsOnly('processing');
      if (sample === 'gps') {
        const f = await createSampleGpsPhoto();
        await handleScanFile(f, { isSample: true, sampleLabel: 'SAMPLE GPS' });
      } else if (sample === 'device') {
        const f = await createSampleDevicePhoto();
        await handleScanFile(f, { isSample: true, sampleLabel: 'SAMPLE DEVICE' });
      } else if (sample === 'pdf') {
        const f = await createSampleResumePdf();
        await handleScanFile(f, { isSample: true, sampleLabel: 'SAMPLE PDF' });
      }
    },
    [clearScanResultsOnly, handleAnalyzeText, handleScanFile]
  );

  useEffect(() => {
    if (!initialSample) return;
    void handleLoadSample(initialSample);
    onConsumeInitialSample?.();
  }, [handleLoadSample, initialSample, onConsumeInitialSample]);

  const handleCancelScan = useCallback(() => {
    scanRunTokenRef.current += 1;
    setScanStatus('cancelled');
    setScanStageLabel('CANCELLED');
    setStages((prev) =>
      prev.map((s) => (s.status === 'active' ? { ...s, status: 'skipped' } : s))
    );
    setTerminalLines((prev) => [...prev, '> SCAN CANCELLED BY USER']);
  }, []);

  const handleRetryScan = useCallback(() => {
    if (inputMode === 'text' && textDraft.trim()) {
      void handleAnalyzeText(textDraft, {
        sourceLabel: activeSource === 'sample' ? 'SAMPLE: Text Post' : 'Pasted Text Draft',
        isSample: activeSource === 'sample',
      });
    } else if (sourceFile) {
      void handleScanFile(sourceFile, {
        isSample: activeSource === 'sample',
      });
    }
  }, [activeSource, handleAnalyzeText, handleScanFile, inputMode, sourceFile, textDraft]);

  const handleSkipReveal = useCallback(() => {
    scanRunTokenRef.current += 1;
    setRevealLimit(999);
    setStages((prev) =>
      prev.map((s) => (s.status === 'active' || s.status === 'pending' ? { ...s, status: 'done' } : s))
    );
    setScanStatus('complete');
    setScanStageLabel('COMPLETE');
  }, []);

  const handleToggleJudgeMode = () => {
    setJudgeMode((prev) => {
      const next = !prev;
      if (next) {
        clearAllInputAndState();
        setInputMode('file');
        navigate('/');
        setCenterTab('findings');
        toast.info('Judge Live Mode enabled. Scanner reset for live demonstration.');
      }
      return next;
    });
  };

  const handleScrubCompleted = (
    afterReport: AnyScanReport,
    nextProof: ProofOfScrub
  ) => {
    setProof(nextProof);
    appendEvent('scrub', 'Cleaning started', nextProof.processingMethod);
    appendEvent('generate', 'Cleaned file generated', nextProof.cleanedFileName);
    appendEvent(
      'verify',
      'Cleaned file re-analyzed',
      `Score changed ${nextProof.originalScore} -> ${nextProof.cleanedScore}`
    );
    activeScanIdRef.current = afterReport.id;
    setIsEnhancing(false);
    setReport(afterReport);
    setDeductions(buildDeterministicDeductions(afterReport));
  };

  const handleHighlightFinding = (findingId: string) => {
    navigate('/');
    setCenterTab('findings');
    setShowFullFindings(true);
    setHighlightedFindingId(findingId);
    window.setTimeout(() => {
      const el = document.getElementById(`finding-row-${findingId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 90);
  };

  const handleTriggerDefenderAction = (target: DefenderActionTarget) => {
    navigate('/');
    if (
      target === 'scrub_location' ||
      target === 'scrub_document' ||
      target === 'scrub_file'
    ) {
      setCenterTab('scrubber');
      setShowFullFindings(true);
    } else if (target === 'normalize_text') {
      setCenterTab('findings');
      setShowFullFindings(true);
      window.setTimeout(() => {
        document.getElementById('clean-copy-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 90);
    } else if (target === 'review_visual') {
      setCenterTab('findings');
      setShowFullFindings(true);
      window.setTimeout(() => {
        document.getElementById('visual-inspection-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 90);
    }
  };

  const handleEnhanceWithGemini = async () => {
    if (!report) return;
    const targetReportId = report.id;
    setIsEnhancing(true);
    setScanStatus('waiting_ai');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 28000);
    try {
      const payload = buildMinimizedFindings(report);
      const res = await fetch('/api/deduce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          consentGranted: true,
          ...payload,
        }),
      });
      const data = await res.json();
      if (activeScanIdRef.current !== targetReportId) return;
      if (!res.ok) {
        toast.error(data.error || 'Could not generate Gemini explanations.');
        setScanStatus('complete');
        return;
      }
      setDeductions(data.deductions ?? []);
      setDeductionProvider(data.provider ?? 'deterministic-fallback');
      setDeductionNote(data.reason ?? null);
      setScanStatus('complete');
      toast.success(
        data.provider === 'gemini'
          ? 'Gemini grounded explanations ready.'
          : 'Deterministic explanation fallback applied.'
      );
    } catch {
      if (activeScanIdRef.current === targetReportId) {
        setScanStatus('complete');
        toast.error('Timed out or network error while contacting /api/deduce.');
      }
    } finally {
      window.clearTimeout(timer);
      if (activeScanIdRef.current === targetReportId) {
        setIsEnhancing(false);
      }
    }
  };

  const handleSaveReport = async () => {
    if (!report) return;
    setSavingReport(true);
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileType: report.kind,
          fieldsFound: report.fieldsFound,
          deductions: deductions.map((d) => d.observation).slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save report summary.');
        return;
      }
      toast.success(
        `Minimized summary saved. Access expires at ${new Date(data.expiresAt).toLocaleTimeString()}.`
      );
      void fetchSavedReports();
    } catch {
      toast.error('Failed to save report summary.');
    } finally {
      setSavingReport(false);
    }
  };

  const handleExportJson = () => {
    if (!report) return;
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      product: 'EXHAUST — AN INITIATIVE BY PROJECT WOW UNSEEN',
      report: {
        ...report,
        previewUrl: undefined,
      },
      deductions,
      proofOfScrub: proof ? { ...proof, cleanedBlobUrl: undefined } : null,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exhaust-report-${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Forensic report JSON exported.');
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      const res = await fetch(`/api/scans/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSavedReports((prev) => prev.filter((r) => r.id !== id));
        toast.success('Saved report deleted.');
      }
    } catch {
      toast.error('Failed to delete report.');
    }
  };

  const gaugeScore = !report
    ? 0
    : report.kind === 'text'
      ? report.patternStrengthIndex
      : report.risk.score;

  const gaugeBand = !report
    ? 'AWAITING INPUT'
    : report.kind === 'text'
      ? report.patternBand
      : report.risk.band;

  const presentFindings = report ? report.findings.filter((f) => f.present) : [];
  const activeTheme = getRiskThemeForReport(report);

  const topKeyCards = presentFindings.slice(0, 4).map((f) => {
    const isCritical = f.id === 'where_gps' || f.id === 'device_serial' || f.id === 'pdf_author';
    const contrib =
      report && report.kind !== 'text'
        ? report.risk.contributions.find(
            (c) =>
              c.present &&
              f.label.toLowerCase().includes(c.label.split(' ')[0].toLowerCase())
          )?.points
        : undefined;
    const pts = contrib ?? (isCritical ? 40 : 10);
    return {
      finding: f,
      isCritical,
      pointsLabel: report?.kind === 'text' ? 'STYLE' : `+${pts}`,
    };
  });

  // 5-Step Pipeline Stepper status (typed cleanly)
  const stepIndex: number =
    !activeInputType && !report
      ? 0
      : scanStatus === 'processing'
        ? 1
        : scanStatus === 'revealing'
          ? 3
          : scanStatus === 'waiting_ai'
            ? 4
            : report && scanStatus === 'complete'
              ? 5
              : 1;

  const pipelineSteps = [
    { label: 'Upload', done: stepIndex >= 1, active: stepIndex === 0 },
    { label: 'Scanning', done: stepIndex >= 2, active: stepIndex === 1 },
    { label: 'Analyze', done: stepIndex >= 3, active: stepIndex === 2 },
    { label: 'Deductions', done: stepIndex >= 4, active: stepIndex === 3 },
    { label: 'Recommendations', done: stepIndex >= 5, active: stepIndex === 4 },
  ];

  const headlinePhrase = !report
    ? { prefix: 'Privacy', accent: 'Inspection', accentClass: 'text-[#00545F]' }
    : report.kind === 'text'
      ? { prefix: 'Writing Pattern', accent: 'Structure', accentClass: 'text-[#00545F]' }
      : report.risk.score >= 80
        ? { prefix: 'High', accent: 'Privacy Exposure', accentClass: 'text-[#FF4B4B]' }
        : report.risk.score >= 55
          ? { prefix: 'Elevated', accent: 'Privacy Exposure', accentClass: 'text-[#EA580C]' }
          : report.risk.score >= 25
            ? { prefix: 'Moderate', accent: 'Privacy Exposure', accentClass: 'text-[#D97706]' }
            : { prefix: 'Low', accent: 'Privacy Exposure', accentClass: 'text-[#0F766E]' };

  const summarySentence = !report
    ? 'Drop a photo, PDF, or text sample to see what embedded data travels with your file.'
    : report.kind === 'text'
      ? report.interpretationNotice
      : report.risk.score >= 80
        ? 'This file reveals your location, device, or embedded document identifiers.'
        : report.risk.score >= 55
          ? 'This file carries multiple device or authorship signals visible to recipients.'
          : report.risk.score >= 25
            ? 'Partial timestamp or software metadata was detected in this file.'
            : 'No high-risk embedded location or hardware serial metadata was found by the local parser.';

  return (
    <div className="min-h-screen flex flex-col bg-unseen-grid text-[#08090B]">
      {/* UNSEEN Top Bar */}
      <TopNavBar
        currentRoute={route}
        onNavigate={navigate}
        judgeMode={judgeMode}
        onToggleJudgeMode={handleToggleJudgeMode}
        redteamMode={redteamMode}
        onToggleRedteam={() => setRedteamMode((r) => !r)}
        onReplayExperience={onReplayExperience}
        savedCount={savedReports.length}
      />

      {route === '/tools' ? (
        <ToolsPage
          onLaunchScanner={(sample) => {
            navigate('/');
            if (sample) {
              void handleLoadSample(sample);
            }
          }}
        />
      ) : route === '/impact' ? (
        <ImpactPage
          onOpenScanner={() => navigate('/')}
          onReplayIntro={onReplayExperience}
        />
      ) : route === '/about' ? (
        <AboutPage onOpenScanner={() => navigate('/')} />
      ) : route === '/contact' ? (
        <ContactPage />
      ) : route === '/investigations' ? (
        <InvestigationsPage
          savedReports={savedReports}
          loadingReports={loadingReports}
          onRefresh={() => void fetchSavedReports()}
          onDelete={(id) => void handleDeleteSaved(id)}
          onReturnToScanner={() => navigate('/')}
          healthDetails={healthDetails}
          onReplayExperience={onReplayExperience}
          onViewWall={onViewWall}
        />
      ) : (
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-5 pb-24 md:pb-6 space-y-4">
          {/* Top 5-Step Progress Pipeline */}
          <nav
            aria-label="Forensic Scan Progress"
            className="hidden sm:flex items-center justify-center max-w-2xl mx-auto pb-1"
          >
            {pipelineSteps.map((st, idx) => (
              <div key={st.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                      st.done
                        ? 'bg-[#CDF22B] text-[#08090B] border border-[#95ba07]'
                        : st.active
                          ? 'bg-white text-[#08090B] border-4 border-[#CDF22B] ring-2 ring-[#08090B]'
                          : 'bg-white text-[#94A3B8] border border-[#08090B]/15'
                    }`}
                  >
                    {st.done ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : null}
                  </div>
                  <span
                    className={`font-sans text-[11px] whitespace-nowrap ${
                      st.done || st.active ? 'font-semibold text-[#08090B]' : 'text-[#525866]'
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
                {idx < pipelineSteps.length - 1 && (
                  <div
                    className={`h-[2px] flex-1 mx-2 -mt-4 rounded-full transition-colors ${
                      pipelineSteps[idx + 1].done || st.done
                        ? 'bg-[#CDF22B]'
                        : 'bg-[#08090B]/10'
                    }`}
                  />
                )}
              </div>
            ))}
          </nav>

          {/* 3-Column Bento Workstation Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* LEFT RAIL: Editorial Hero + Navigation Pills + Auto-Delete Notice */}
            <aside
              aria-label="Workstation Navigation"
              className="lg:col-span-2 flex flex-col justify-between gap-4 order-1"
            >
              <div className="space-y-3">
                <h1 className="font-display text-3xl xl:text-[34px] font-bold leading-[0.95] text-[#08090B]">
                  Reveal the{' '}
                  <span className="inline-block bg-[#08090B] text-[#CDF22B] px-2.5 py-0.5 rounded-2xl shadow-[0_4px_0_#000] -rotate-1">
                    unseen
                  </span>{' '}
                  in your files.
                </h1>
                <p className="font-sans text-xs text-[#525866] leading-relaxed">
                  Drop a photo, PDF or text. See the invisible data it leaks, understand the risk, and clean it in one click.
                </p>
              </div>

              <nav className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-1 gap-1.5">
                {[
                  {
                    id: 'findings' as const,
                    label: 'X-Ray Scanner',
                    icon: Scan,
                    onClick: () => setCenterTab('findings'),
                    active: centerTab === 'findings',
                  },
                  {
                    id: 'graph' as const,
                    label: 'Evidence Graph',
                    icon: Network,
                    onClick: () => setCenterTab('graph'),
                    active: centerTab === 'graph',
                  },
                  {
                    id: 'scrubber' as const,
                    label: 'Scrubber & Proof',
                    icon: Sparkles,
                    onClick: () => setCenterTab('scrubber'),
                    active: centerTab === 'scrubber',
                  },
                  {
                    id: 'surface' as const,
                    label: 'OSINT Workspace',
                    icon: Search,
                    onClick: () => setCenterTab('surface'),
                    active: centerTab === 'surface',
                  },
                  {
                    id: 'reports' as const,
                    label: 'Reports',
                    icon: FolderClock,
                    onClick: () => navigate('/investigations'),
                    active: false,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl font-sans text-xs font-semibold text-left transition-all cursor-pointer ${
                        item.active
                          ? 'bg-[#CDF22B] text-[#08090B] border border-[#95ba07]/45 shadow-xs'
                          : 'bg-white/70 lg:bg-transparent text-[#08090B]/80 hover:bg-white hover:text-[#08090B] border border-transparent hover:border-[#08090B]/8'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="hidden lg:flex card-unseen p-3.5 items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FAF8F3] border border-[#08090B]/10 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4 text-[#08090B]" />
                </div>
                <div className="min-w-0">
                  <span className="font-sans text-[11px] text-[#525866] block leading-tight">
                    Records Auto-Delete
                  </span>
                  <span className="font-display text-xs font-bold text-[#08090B]">
                    2 Hours (TTL)
                  </span>
                </div>
              </div>
            </aside>

            {/* CENTER WORKSPACE: Bento Grid (Input Preview + Main Intelligence Card + Bottom Scrub Dock) */}
            <div className="lg:col-span-7 space-y-4 order-2 min-w-0">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                {/* Input Preview + Compact Dropzone */}
                <div className="xl:col-span-5 space-y-3 min-w-0">
                  <CurrentInputPanel
                    inputType={activeInputType}
                    title={activeTitle}
                    formatLabel={activeFormatLabel}
                    sizeBytes={activeSizeBytes}
                    dimensions={activeDimensions}
                    pageCount={activePageCount}
                    source={activeSource}
                    previewUrl={activePreviewUrl}
                    pdfBytes={activePdfBytes}
                    textSnippet={activeInputType === 'text' ? textDraft : undefined}
                    scanStatus={scanStatus}
                    report={report}
                    highlightedVisualObs={highlightedVisualObs}
                    onAnalyze={handleRetryScan}
                    onClear={clearAllInputAndState}
                  />

                  <DropzoneTerminal
                    inputMode={inputMode}
                    onInputModeChange={handleInputModeChange}
                    textInput={textDraft}
                    onTextInputChange={handleTextInputChange}
                    scanStatus={scanStatus}
                    stages={stages}
                    terminalLines={terminalLines}
                    scanProgressStage={scanStageLabel}
                    onFileSelected={(f) => void handleScanFile(f)}
                    onTextAnalyze={(txt) => void handleAnalyzeText(txt)}
                    onLoadSample={(s) => void handleLoadSample(s)}
                    onCancelScan={handleCancelScan}
                    onRetryScan={handleRetryScan}
                    onNewScan={clearAllInputAndState}
                    onSkipReveal={handleSkipReveal}
                    judgeMode={judgeMode}
                    compact={Boolean(report || activeInputType)}
                  />
                </div>

                {/* Main White Intelligence Card matching mockup */}
                <div className="xl:col-span-7 space-y-4 min-w-0">
                  <section
                    aria-label="Exposure Intelligence Summary"
                    className={`card-unseen p-4 sm:p-5 space-y-4 transition-colors duration-300 ${
                      report ? activeTheme.borderClass : ''
                    }`}
                  >
                    {/* Top Split: Gauge + Dynamic Severity Headline */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                      <div className="sm:col-span-5">
                        <ExposureGauge
                          inline
                          mode={report ? report.kind : 'idle'}
                          score={gaugeScore}
                          band={gaugeBand}
                          statusWord={
                            report && report.kind !== 'text'
                              ? report.risk.statusWord
                              : undefined
                          }
                          contributions={
                            report && report.kind !== 'text'
                              ? report.risk.contributions
                              : []
                          }
                          methodologyNote={
                            report && report.kind !== 'text'
                              ? report.risk.methodologyNote
                              : undefined
                          }
                          tooShortText={
                            report?.kind === 'text' ? report.tooShortForMetrics : false
                          }
                          enlarged={judgeMode}
                        />
                      </div>

                      <div className="sm:col-span-7 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="font-display text-2xl font-bold leading-tight text-[#08090B]">
                            <span className={headlinePhrase.accentClass}>
                              {headlinePhrase.prefix}
                            </span>{' '}
                            {headlinePhrase.accent}
                          </h2>
                          {report && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={savingReport}
                                onClick={handleSaveReport}
                                title="Save minimized report summary (2h TTL)"
                                className="px-2.5 py-1 rounded-xl border border-[#08090B]/12 bg-[#FAF8F3] hover:bg-[#ECFFB6] font-mono text-[10px] font-semibold text-[#08090B] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Save className="w-3 h-3" />
                                {savingReport ? 'Saving' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={handleExportJson}
                                title="Export forensic report JSON"
                                className="px-2.5 py-1 rounded-xl border border-[#08090B]/12 bg-[#FAF8F3] hover:bg-[#ECFFB6] font-mono text-[10px] font-semibold text-[#08090B] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                JSON
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="font-sans text-xs text-[#525866] leading-relaxed">
                          {summarySentence}
                        </p>

                        {/* Category Signal Badges matching mockup */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {report?.kind === 'text' ? (
                            <>
                              <span className="px-2.5 py-1 rounded-full bg-[#F0FDFA] border border-[#00545F]/25 text-[#00545F] font-mono text-[10px] font-semibold">
                                Structure
                              </span>
                              <span className="px-2.5 py-1 rounded-full bg-[#F0FDFA] border border-[#00545F]/25 text-[#00545F] font-mono text-[10px] font-semibold">
                                Non-Authorship
                              </span>
                            </>
                          ) : (
                            [
                              {
                                label: 'Location',
                                icon: MapPin,
                                active: Boolean(
                                  report?.fieldsFound.gps ||
                                    presentFindings.some((f) => f.category === 'WHERE')
                                ),
                                critical: true,
                              },
                              {
                                label: 'Device',
                                icon: Camera,
                                active: Boolean(
                                  report?.fieldsFound.device ||
                                    report?.fieldsFound.serial ||
                                    presentFindings.some((f) => f.category === 'DEVICE')
                                ),
                                critical: Boolean(report?.fieldsFound.serial),
                              },
                              {
                                label: 'Time',
                                icon: CalendarClock,
                                active: Boolean(
                                  report?.fieldsFound.timestamp ||
                                    report?.fieldsFound.pdf_dates ||
                                    presentFindings.some((f) => f.category === 'WHEN')
                                ),
                                critical: false,
                              },
                              {
                                label: 'Metadata',
                                icon: Layers,
                                active: presentFindings.length > 0,
                                critical: Boolean(report && report.risk.score >= 80),
                              },
                            ].map((tag) => {
                              const TagIcon = tag.icon;
                              return (
                                <span
                                  key={tag.label}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-sans text-[11px] font-medium border ${
                                    !report
                                      ? 'bg-[#FAF8F3] border-[#08090B]/10 text-[#525866]'
                                      : tag.active && tag.critical
                                        ? 'bg-[#FFF2F2] border-[#FF4B4B]/35 text-[#B91C1C]'
                                        : tag.active
                                          ? 'bg-[#FFFBEB] border-[#F59E0B]/40 text-[#92400E]'
                                          : 'bg-[#FAF8F3] border-[#08090B]/8 text-[#94A3B8]'
                                  }`}
                                >
                                  <TagIcon className="w-3 h-3" />
                                  {tag.label}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Key Findings (4) Horizontal Cards Grid matching mockup */}
                    <div className="space-y-2 pt-2 border-t border-[#08090B]/8">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-xs font-bold text-[#08090B] flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-[#00545F]" />
                          <span>Key Findings ({presentFindings.length})</span>
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setCenterTab('findings');
                            setShowFullFindings((s) => !s);
                          }}
                          className="font-sans text-[11px] font-semibold text-[#08090B] hover:text-[#00545F] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>{showFullFindings ? 'Hide Details' : 'View All'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      {!report ? (
                        <div className="rounded-2xl border border-dashed border-[#08090B]/12 bg-[#FAF8F3] p-4 text-center font-mono text-[11px] text-[#525866]">
                          Select a Judge Live Sample or upload a file to extract Key Findings.
                        </div>
                      ) : topKeyCards.length === 0 ? (
                        <div className="rounded-2xl border border-[#12A36B]/30 bg-[#F2FBF6] p-3.5 font-mono text-xs text-[#0F766E] font-semibold">
                          No exposed metadata fields detected by the local parser.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {topKeyCards.map(({ finding, isCritical, pointsLabel }) => (
                            <button
                              key={finding.id}
                              type="button"
                              onClick={() => handleHighlightFinding(finding.id)}
                              className={`text-left rounded-2xl border p-2.5 transition-all hover:scale-[1.01] cursor-pointer ${
                                isCritical
                                  ? 'bg-[#FFF2F2] border-[#FF4B4B]/30'
                                  : report.kind === 'text'
                                    ? 'bg-[#F0FDFA] border-[#00545F]/25'
                                    : 'bg-[#FFFBEB] border-[#F59E0B]/35'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isCritical
                                      ? 'bg-[#FF4B4B]'
                                      : report.kind === 'text'
                                        ? 'bg-[#00545F]'
                                        : 'bg-[#F59E0B]'
                                  }`}
                                />
                                <span
                                  className={`font-mono text-[10px] font-bold ${
                                    isCritical
                                      ? 'text-[#FF4B4B]'
                                      : report.kind === 'text'
                                        ? 'text-[#00545F]'
                                        : 'text-[#B45309]'
                                  }`}
                                >
                                  {pointsLabel}
                                </span>
                              </div>
                              <div className="font-display text-[11px] font-bold text-[#08090B] truncate">
                                {finding.label}
                              </div>
                              <div
                                className="font-mono text-[10px] text-[#525866] truncate mt-0.5"
                                title={finding.value}
                              >
                                {finding.value}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 2-Column Bottom Split: Location (GPS) + Exposure Flow */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <EvidenceLocationPanel
                        gps={report?.kind === 'image' ? report.gps : null}
                        hasFile={Boolean(report)}
                        hasNoExifMessage={
                          report?.kind === 'image' ? report.hasNoExifMessage : false
                        }
                        enlarged={judgeMode}
                      />

                      {/* Exposure Flow Diagram matching mockup */}
                      <section
                        aria-label="Exposure Flow"
                        className="bg-[#FAF8F3]/80 border border-[#08090B]/8 rounded-2xl p-3.5 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <h3 className="font-display text-xs font-bold text-[#08090B]">
                            Exposure Flow{' '}
                            <span className="font-sans font-normal text-[#525866]">
                              (How it can reach others)
                            </span>
                          </h3>
                        </div>

                        <div className="grid grid-cols-5 gap-1 py-1">
                          {[
                            {
                              icon: User,
                              title: 'You',
                              sub: 'Create',
                              tone: 'bg-[#ECFFB6] text-[#08090B]',
                            },
                            {
                              icon: Share2,
                              title: 'Share',
                              sub: 'File',
                              tone: 'bg-[#ECFFB6] text-[#08090B]',
                            },
                            {
                              icon: Download,
                              title: 'Anyone',
                              sub: 'Save',
                              tone: 'bg-[#ECFFB6] text-[#08090B]',
                            },
                            {
                              icon: Search,
                              title: 'OSINT',
                              sub: '~5s parse',
                              tone:
                                report && presentFindings.length > 0
                                  ? 'bg-[#FEF3C7] text-[#92400E]'
                                  : 'bg-[#ECFFB6] text-[#08090B]',
                            },
                            {
                              icon: UserCheck,
                              title: 'Profiler',
                              sub:
                                proof && proof.cleanedScore < 25
                                  ? 'Blocked'
                                  : 'Profile',
                              tone:
                                proof && proof.cleanedScore < 25
                                  ? 'bg-[#D1FAE5] text-[#065F46]'
                                  : report && presentFindings.length > 0
                                    ? 'bg-[#FFE5E5] text-[#B91C1C]'
                                    : 'bg-white text-[#525866] border border-[#08090B]/10',
                            },
                          ].map((node, idx, arr) => {
                            const NodeIcon = node.icon;
                            return (
                              <div key={node.title} className="relative flex flex-col items-center text-center min-w-0">
                                <div
                                  className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center ${node.tone}`}
                                >
                                  <NodeIcon className="w-3.5 h-3.5" />
                                </div>
                                {idx < arr.length - 1 && (
                                  <span
                                    aria-hidden="true"
                                    className="hidden sm:block absolute top-3.5 left-[62%] w-[76%] h-[1.5px] bg-[#08090B]/15 z-0"
                                  />
                                )}
                                <span className="font-display text-[9.5px] font-bold text-[#08090B] mt-1 leading-none truncate w-full">
                                  {node.title}
                                </span>
                                <span className="font-sans text-[8.5px] text-[#525866] mt-0.5 leading-none truncate w-full">
                                  {node.sub}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <p className="font-sans text-[10px] text-[#525866] leading-snug">
                          {proof && proof.cleanedScore < 25
                            ? 'Cleaned output strips metadata before anyone can parse it.'
                            : 'Removing embedded metadata breaks the OSINT inspection step.'}
                        </p>
                      </section>
                    </div>
                  </section>
                </div>
              </div>

              {/* Bottom Full-Width Dark Scrub Dock matching mockup */}
              {report && (
                <ScrubberPanel
                  compactDock
                  report={report}
                  sourceFile={sourceFile}
                  proof={proof}
                  timeline={timeline}
                  onScrubCompleted={handleScrubCompleted}
                  highlighted={judgeMode}
                  onOpenProofTab={() => {
                    setCenterTab('scrubber');
                    setShowFullFindings(true);
                  }}
                />
              )}

              {/* Expanded Workspace Views (Findings / Visual Lab / Scrubber Proof / Graph / OSINT) */}
              {(report && (showFullFindings || centerTab !== 'findings')) && (
                <div className="space-y-4 pt-1">
                  {/* Workspace View Selector Pills */}
                  <div
                    role="tablist"
                    aria-label="Forensic Workspace Tabs"
                    className="flex flex-wrap gap-1.5 bg-white border border-[#08090B]/8 rounded-2xl p-1.5"
                  >
                    {[
                      { id: 'findings' as const, label: 'Findings & Visual Lab', icon: Layers },
                      { id: 'scrubber' as const, label: 'Scrubber & Proof', icon: Sparkles },
                      { id: 'graph' as const, label: 'Evidence Graph', icon: FileSearch },
                      { id: 'surface' as const, label: 'Web & OSINT', icon: Search },
                    ].map((tab) => {
                      const TabIcon = tab.icon;
                      const active = centerTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setCenterTab(tab.id)}
                          className={`flex-1 min-w-[120px] px-3 py-2 rounded-xl font-mono text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            active
                              ? 'bg-[#08090B] text-[#CDF22B]'
                              : 'text-[#525866] hover:text-[#08090B] hover:bg-[#FAF8F3]'
                          }`}
                        >
                          <TabIcon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {centerTab === 'findings' && (
                    <div className="space-y-4">
                      <InvisibleLayerAndFindings
                        report={report}
                        highlightedFindingId={highlightedFindingId}
                        scanStatus={scanStatus}
                        revealLimit={revealLimit}
                        onSkipReveal={handleSkipReveal}
                        onSelectFinding={(id) => setHighlightedFindingId(id)}
                      />
                      {report.kind === 'image' && (
                        <div id="visual-inspection-section">
                          <VisualInspectionPanel
                            report={report}
                            sourceFile={sourceFile}
                            inspectionResult={visualInspection}
                            highlightedObsId={highlightedVisualObs?.id ?? null}
                            onInspectionResult={(res) => setVisualInspection(res)}
                            onHighlightObservation={(obs) => setHighlightedVisualObs(obs)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {centerTab === 'scrubber' && (
                    <ScrubberPanel
                      report={report}
                      sourceFile={sourceFile}
                      proof={proof}
                      timeline={timeline}
                      onScrubCompleted={handleScrubCompleted}
                      highlighted={judgeMode}
                    />
                  )}

                  {centerTab === 'graph' && (
                    <EvidenceGraphPanel
                      report={report}
                      onSelectFindingNode={handleHighlightFinding}
                    />
                  )}

                  {centerTab === 'surface' && (
                    <WebsiteAndOsintSummary report={report} />
                  )}
                </div>
              )}

              {!report && centerTab === 'surface' && !judgeMode && (
                <WebsiteAndOsintSummary report={null} />
              )}
            </div>

            {/* RIGHT RAIL: Agent X Portrait Card + Expandable Defender Cards */}
            <div className="lg:col-span-3 order-3 min-w-0">
              <ProfilerFeed
                report={report}
                proof={proof}
                scanStatus={scanStatus}
                deductions={deductions}
                deductionProvider={deductionProvider}
                deductionNote={deductionNote}
                isEnhancing={isEnhancing}
                redteamMode={redteamMode}
                onToggleRedteam={() => setRedteamMode((r) => !r)}
                onEnhanceWithGemini={() => void handleEnhanceWithGemini()}
                onHighlightFinding={handleHighlightFinding}
                onTriggerDefenderAction={handleTriggerDefenderAction}
              />
            </div>
          </div>
        </main>
      )}

      {/* Verifiable Security Status Strip */}
      <div className="pb-20 md:pb-0">
        <SecurityStatusStrip />
      </div>

      {/* Mobile Floating Bottom Capsule Navigation (UNSEEN Responsive Mobile Dock) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-3 inset-x-3 z-40 rounded-3xl bg-white/95 backdrop-blur-md border border-[#08090B]/12 shadow-[0_12px_32px_rgba(8,9,11,0.16)] px-2 py-1.5 flex items-center justify-around gap-1"
      >
        {(
          [
            { route: '/' as const, label: 'Scan', icon: Scan },
            { route: '/about' as const, label: 'About', icon: Compass },
            { route: '/tools' as const, label: 'Tools', icon: Wrench },
            { route: '/impact' as const, label: 'Impact', icon: Activity },
            { route: '/investigations' as const, label: 'Reports', icon: FolderClock },
          ]
        ).map((item) => {
          const Icon = item.icon;
          const active = route === item.route;
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => navigate(item.route)}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[44px] flex-1 rounded-2xl flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 transition-all cursor-pointer ${
                active
                  ? 'bg-[#08090B] text-[#CDF22B] shadow-[0_3px_0_#000000]'
                  : 'text-[#525866] hover:text-[#08090B]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="font-sans text-[10px] font-semibold leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
