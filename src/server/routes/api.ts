import dns from 'node:dns/promises';
import net from 'node:net';
import express from 'express';
import { z } from 'zod';
import { recalculateServerScore, SCORING_VERSION } from '../../lib/scoring.ts';
import {
  deleteScanSummary,
  getDatabaseStatus,
  getScanSummaryById,
  listScanSummaries,
  saveScanSummary,
} from '../database/mongo.ts';
import {
  DeduceRequestSchema,
  generateGroundedDeductions,
  isGeminiConfigured,
} from '../geminiDeduce.ts';
import {
  runGeminiVisualInspection,
  VisualInspectRequestSchema,
} from '../geminiVisual.ts';
import { checkRateLimit } from '../rateLimit.ts';
import { getOrCreateSessionHash } from '../session.ts';

const SaveScanSchema = z.object({
  fileType: z.enum(['image', 'pdf', 'text', 'website']),
  fieldsFound: z.record(z.string().max(64), z.boolean()),
  deductions: z.array(z.string().max(400)).max(25).default([]),
});

const WebsiteInspectSchema = z.object({
  url: z.string().url().max(500),
});

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80')
    );
  }
  return true;
}

export function createApiRouter(): express.Router {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    const db = getDatabaseStatus();
    res.json({
      ok: true,
      mode: db.mode,
      databaseConnected: db.databaseConnected,
      ttlIndexVerified: db.ttlIndexVerified,
      ttlSeconds: db.ttlSeconds,
      geminiConfigured: isGeminiConfigured(),
      osmConfigured: Boolean(process.env.OPENSTREETMAP?.trim()),
      scoringVersion: SCORING_VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  router.post('/scans', async (req, res) => {
    const ownerSessionHash = getOrCreateSessionHash(req, res);
    const parsed = SaveScanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid scan summary payload',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { fileType, fieldsFound, deductions } = parsed.data;
    const { riskScore, band } = recalculateServerScore(fileType, fieldsFound);

    try {
      const saved = await saveScanSummary({
        ownerSessionHash,
        fileType,
        fieldsFound,
        riskScore,
        band,
        scoringVersion: SCORING_VERSION,
        deductions,
      });
      res.status(201).json(saved);
    } catch {
      res.status(500).json({ error: 'Failed to persist scan summary.' });
    }
  });

  router.get('/scans', async (req, res) => {
    const ownerSessionHash = getOrCreateSessionHash(req, res);
    try {
      const items = await listScanSummaries(ownerSessionHash);
      res.json({ scans: items });
    } catch {
      res.status(500).json({ error: 'Failed to retrieve saved scans.' });
    }
  });

  router.get('/scans/:id', async (req, res) => {
    const ownerSessionHash = getOrCreateSessionHash(req, res);
    const id = req.params.id;
    if (!id || id.length > 100) {
      res.status(400).json({ error: 'Invalid report ID.' });
      return;
    }

    try {
      const result = await getScanSummaryById(id, ownerSessionHash);
      if (result.status === 'not_found') {
        res.status(404).json({ error: 'Report not found.' });
        return;
      }
      if (result.status === 'forbidden') {
        res.status(403).json({ error: 'Access denied for this session.' });
        return;
      }
      if (result.status === 'expired') {
        res.status(410).json({ error: 'Report access expired after two hours.' });
        return;
      }
      res.json(result.report);
    } catch {
      res.status(500).json({ error: 'Failed to load report.' });
    }
  });

  router.delete('/scans/:id', async (req, res) => {
    const ownerSessionHash = getOrCreateSessionHash(req, res);
    const id = req.params.id;
    try {
      const result = await deleteScanSummary(id, ownerSessionHash);
      if (result === 'not_found') {
        res.status(404).json({ error: 'Report not found.' });
        return;
      }
      if (result === 'forbidden') {
        res.status(403).json({ error: 'Access denied for this session.' });
        return;
      }
      res.json({ deleted: true, id });
    } catch {
      res.status(500).json({ error: 'Failed to delete report.' });
    }
  });

  router.post('/deduce', async (req, res) => {
    const ownerSessionHash = getOrCreateSessionHash(req, res);
    const rl = await checkRateLimit(`deduce:${ownerSessionHash}`, 10, 60_000);
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSeconds));
      res.status(429).json({
        error: 'Rate limit exceeded for AI deduction explanations (10/min).',
        retryAfterSeconds: rl.retryAfterSeconds,
      });
      return;
    }

    const parsed = DeduceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid or unconsented deduction request payload.',
      });
      return;
    }

    const result = await generateGroundedDeductions(parsed.data);
    res.json(result);
  });

  router.post('/visual-inspect', async (req, res) => {
    const ownerSessionHash = getOrCreateSessionHash(req, res);
    const rl = await checkRateLimit(`visual:${ownerSessionHash}`, 6, 60_000);
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSeconds));
      res.status(429).json({
        error: 'Rate limit exceeded for AI visual inspection (6/min).',
        retryAfterSeconds: rl.retryAfterSeconds,
      });
      return;
    }

    const parsed = VisualInspectRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Explicit consent and a supported JPEG, PNG, or WebP image are required.',
      });
      return;
    }

    const result = await runGeminiVisualInspection(parsed.data);
    res.json(result);
  });

  router.post('/website/inspect', async (req, res) => {
    const ownerSessionHash = getOrCreateSessionHash(req, res);
    const rl = await checkRateLimit(`web:${ownerSessionHash}`, 15, 60_000);
    if (!rl.allowed) {
      res.status(429).json({ error: 'Rate limit exceeded for website summary.' });
      return;
    }

    const parsed = WebsiteInspectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please enter a valid http:// or https:// URL.' });
      return;
    }

    let target: URL;
    try {
      target = new URL(parsed.data.url);
      if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        res.status(400).json({ error: 'Only HTTP/HTTPS URLs are supported.' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Malformed URL.' });
      return;
    }

    const hostname = target.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      net.isIP(hostname) && isPrivateIp(hostname)
    ) {
      res.status(400).json({ error: 'Private or loopback hostnames are blocked.' });
      return;
    }

    try {
      const resolved = await dns.lookup(hostname, { all: true });
      if (resolved.some((r) => isPrivateIp(r.address))) {
        res.status(400).json({ error: 'Target resolves to a restricted network range.' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Could not resolve target hostname.' });
      return;
    }

    try {
      const response = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'EXHAUST-Passive-Summary/3.0',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      const securityHeaders: Record<string, string | null> = {
        'strict-transport-security': response.headers.get('strict-transport-security'),
        'content-security-policy': response.headers.get('content-security-policy'),
        'x-frame-options': response.headers.get('x-frame-options'),
        'x-content-type-options': response.headers.get('x-content-type-options'),
        'referrer-policy': response.headers.get('referrer-policy'),
      };

      const setCookieHeader = response.headers.get('set-cookie');
      const cookieNotes: string[] = [];
      let cookieCount = 0;
      if (setCookieHeader) {
        cookieCount = setCookieHeader.split(/,(?=[^;]+=)/).length;
        if (!/HttpOnly/i.test(setCookieHeader)) cookieNotes.push('Missing HttpOnly flag observed');
        if (!/Secure/i.test(setCookieHeader)) cookieNotes.push('Missing Secure flag observed');
      }

      const contentType = response.headers.get('content-type') ?? '';
      let pageTitle: string | null = null;
      let metaDescription: string | null = null;
      const techIndicators: string[] = [];
      const thirdPartyHosts = new Set<string>();

      const serverHeader = response.headers.get('server');
      const poweredBy = response.headers.get('x-powered-by');
      if (serverHeader) techIndicators.push(`Server: ${serverHeader}`);
      if (poweredBy) techIndicators.push(`X-Powered-By: ${poweredBy}`);

      if (contentType.includes('text/html')) {
        const html = (await response.text()).slice(0, 120_000);
        const titleMatch = html.match(/<title[^>]*>([^<]{1,160})<\/title>/i);
        if (titleMatch) pageTitle = titleMatch[1].trim();
        const descMatch = html.match(
          /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,240})["']/i
        );
        if (descMatch) metaDescription = descMatch[1].trim();

        const srcMatches = html.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)["']/gi);
        for (const m of srcMatches) {
          try {
            const h = new URL(m[1]).hostname;
            if (h !== hostname) thirdPartyHosts.add(h);
          } catch {
            // ignore invalid URI
          }
          if (thirdPartyHosts.size >= 8) break;
        }
      }

      res.json({
        url: parsed.data.url,
        finalUrl: response.url || parsed.data.url,
        httpsAvailable: target.protocol === 'https:',
        redirectCount: response.status >= 300 && response.status < 400 ? 1 : 0,
        statusCode: response.status,
        securityHeaders,
        cookieCount,
        cookieNotes,
        pageTitle,
        metaDescription,
        techIndicators,
        thirdPartyHosts: Array.from(thirdPartyHosts),
        robotsTxtPresent: false,
        securityTxtPresent: false,
        inspectedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(502).json({
        error:
          err instanceof Error
            ? `Inspection request failed: ${err.message}`
            : 'Inspection request timed out or failed.',
      });
    }
  });

  router.get('/location/reverse', async (req, res) => {
    const ownerSessionHash = getOrCreateSessionHash(req, res);
    const rl = await checkRateLimit(`geo:${ownerSessionHash}`, 20, 60_000);
    if (!rl.allowed) {
      res.status(429).json({ error: 'Rate limit exceeded for location lookup.' });
      return;
    }

    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
      return;
    }

    const osmKey = process.env.OPENSTREETMAP?.trim();
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat.toFixed(5)
      )}&lon=${encodeURIComponent(lon.toFixed(5))}&zoom=14&addressdetails=1`;

      const headers: Record<string, string> = {
        'User-Agent': 'EXHAUST-ForensicMirror/4.0 (Project WOW Unseen)',
        Accept: 'application/json',
      };
      if (osmKey) {
        headers['X-API-Key'] = osmKey;
      }

      const upstream = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(4500),
      });

      if (!upstream.ok) {
        res.json({
          areaLabel: null,
          country: null,
          provider: 'openstreetmap-fallback',
        });
        return;
      }

      const data = (await upstream.json()) as {
        address?: Record<string, string>;
        display_name?: string;
      };
      const addr = data.address ?? {};
      const city =
        addr.city || addr.town || addr.village || addr.suburb || addr.county || null;
      const state = addr.state || null;
      const country = addr.country || null;
      const areaLabel = [city, state, country].filter(Boolean).join(', ') || null;

      res.json({
        areaLabel,
        country,
        provider: osmKey ? 'openstreetmap-key' : 'openstreetmap-public',
      });
    } catch {
      res.json({
        areaLabel: null,
        country: null,
        provider: 'openstreetmap-fallback',
      });
    }
  });

  router.get('/location/tile/:z/:x/:y.png', async (req, res) => {
    const z = Number(req.params.z);
    const x = Number(req.params.x);
    const y = Number(req.params.y);
    if (
      !Number.isInteger(z) ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      z < 0 ||
      z > 19 ||
      x < 0 ||
      y < 0
    ) {
      res.status(400).end();
      return;
    }

    const osmKey = process.env.OPENSTREETMAP?.trim();
    const headers: Record<string, string> = {
      'User-Agent': 'EXHAUST-ForensicMirror/4.0 (Project WOW Unseen)',
      Referer: process.env.APP_URL || 'https://exhaust-forensic-mirror.local',
      ...(osmKey ? { 'X-API-Key': osmKey } : {}),
    };
    const candidates: string[] = [
      `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
      `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`,
      `https://b.tile.openstreetmap.org/${z}/${x}/${y}.png`,
    ];

    for (const url of candidates) {
      try {
        const tileRes = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(4500),
        });
        if (tileRes.ok) {
          const buf = Buffer.from(await tileRes.arrayBuffer());
          res.setHeader('Content-Type', tileRes.headers.get('content-type') || 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.send(buf);
          return;
        }
      } catch {
        // try next OpenStreetMap tile mirror
      }
    }

    res.status(502).end();
  });

  return router;
}
