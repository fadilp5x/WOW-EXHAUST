# EXHAUST — The Forensic Mirror for Your Digital Ghost

*An Initiative by Project WOW Unseen*

EXHAUST is a three-act cinematic privacy-forensics web application that inspects image EXIF/XMP/GPS metadata, PDF document properties, and deterministic text patterns **locally on your device**, explains exposure through a grounded Defender / REDTEAM profiler feed, and scrubs metadata with automatic re-verification.

## Privacy & Processing Model

- **On-device analysis:** Images, PDFs, and text are parsed and scrubbed inside browser memory (`exifr`, `pdf-lib`, HTML5 Canvas). Original file bytes are never uploaded to the EXHAUST server.
- **Optional saved summaries:** Selecting **Save (2h TTL)** sends only a Zod-validated minimized metadata summary (`fieldsFound`, recalculated score, band, deduction observations) to MongoDB Atlas (`exhaust.scans`).
- **Two-hour expiry:** Access is refused server-side after 2 hours (`7200s`) and backed by a MongoDB TTL index on `createdAt`.
- **Consented AI explanations:** Selecting **Explain with Gemini** sends only a minimized redacted finding list (no raw files, no raw GPS coordinates) to `POST /api/deduce`, with deterministic fallback if Gemini is unavailable.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Append `?autostart=1` to jump directly into the Act III Machine workstation.

## Verification

```bash
npm test       # Runs node:test unit suite (EXIF, PDF, Text, Scoring, TTL, Fallback)
npm run lint   # TypeScript type-check
npm run build  # Vite production bundle
```
