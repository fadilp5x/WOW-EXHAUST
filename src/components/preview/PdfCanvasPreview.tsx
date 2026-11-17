import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';

// Configure PDF.js local bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfCanvasPreviewProps {
  pdfBytes: Uint8Array;
  fileName: string;
}

export function PdfCanvasPreview({ pdfBytes, fileName }: PdfCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    setPageNumber(1);
  }, [pdfBytes, fileName]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    async function renderPage() {
      setRendering(true);
      setRenderError(null);
      try {
        // Clone bytes cleanly so PDF.js worker transfer doesn't detach caller's buffer
        const bytesCopy = new Uint8Array(pdfBytes);
        loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        setNumPages(pdf.numPages);
        const safePage = Math.max(1, Math.min(pageNumber, pdf.numPages));
        const page = await pdf.getPage(safePage);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const viewportBase = page.getViewport({ scale: 1 });
        const targetWidth = 460;
        const scale = targetWidth / viewportBase.width;
        const viewport = page.getViewport({ scale });

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        }).promise;
      } catch (err) {
        if (!cancelled) {
          setRenderError(
            err instanceof Error ? err.message : 'Unable to render PDF preview locally.'
          );
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      if (loadingTask) {
        void loadingTask.destroy().catch(() => {});
      }
    };
  }, [pdfBytes, pageNumber]);

  return (
    <div className="border border-[#0B3D1E] bg-[#020604] p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
        <span className="text-[#D7FFE0] inline-flex items-center gap-1.5 truncate">
          <FileText className="w-3.5 h-3.5 text-[#C7FF00] shrink-0" />
          LOCAL PDF RENDER · PAGE {pageNumber} OF {numPages}
        </span>
        {numPages > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={pageNumber <= 1 || rendering}
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              aria-label="Previous PDF page"
              className="p-1 border border-[#0B3D1E] bg-[#07130D] text-[#D7FFE0] hover:border-[#C7FF00] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={pageNumber >= numPages || rendering}
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              aria-label="Next PDF page"
              className="p-1 border border-[#0B3D1E] bg-[#07130D] text-[#D7FFE0] hover:border-[#C7FF00] disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {renderError ? (
        <div className="p-4 text-center font-mono text-xs text-[#FFB000] bg-[#07130D]">
          PDF preview fallback ({renderError})
        </div>
      ) : (
        <div className="relative flex justify-center bg-[#07130D] border border-[#0B3D1E]/70 p-2 max-h-64 overflow-auto">
          <canvas
            ref={canvasRef}
            data-testid="pdf-preview-canvas"
            aria-label={`Rendered preview of ${fileName} page ${pageNumber}`}
            className="max-w-full h-auto shadow-md bg-white"
          />
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 font-mono text-xs text-[#C7FF00]">
              RENDERING PAGE {pageNumber}...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
