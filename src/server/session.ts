import crypto from 'node:crypto';
import type { Request, Response } from 'express';

const COOKIE_NAME = 'exhaust_sid';
const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : EPHEMERAL_SECRET;
}

export function hashSessionId(sid: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`exhaust-owner:${sid}`)
    .digest('hex');
}

function signValue(sid: string): string {
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(sid)
    .digest('base64url');
  return `${sid}.${sig}`;
}

function verifySignedValue(rawCookie: string | undefined): string | null {
  if (!rawCookie || typeof rawCookie !== 'string') return null;
  const dotIdx = rawCookie.indexOf('.');
  if (dotIdx <= 0) return null;
  const sid = rawCookie.slice(0, dotIdx);
  const sig = rawCookie.slice(dotIdx + 1);
  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(sid)
    .digest('base64url');
  if (sig.length !== expected.length) return null;
  const valid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  return valid ? sid : null;
}

export function getOrCreateSessionHash(req: Request, res: Response): string {
  const existingSid = verifySignedValue(req.cookies?.[COOKIE_NAME]);
  if (existingSid) {
    return hashSessionId(existingSid);
  }

  const newSid = crypto.randomUUID();
  const signed = signValue(newSid);
  const isSecure =
    req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie(COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  return hashSessionId(newSid);
}
