# EXHAUST Deployment Guide

## Environment Variables

Configure these server-side environment variables (never expose secrets to client `VITE_` variables):

```env
GEMINI_API_KEY=            # Server-side Gemini API key for POST /api/deduce
MONGODB_URI=               # MongoDB Atlas connection string (least-privilege user on db: exhaust)
SESSION_SECRET=            # 32+ char random HMAC secret for HttpOnly session cookies
APP_URL=                   # Public HTTPS origin URL
RATE_LIMIT_REDIS_URL=      # Optional Upstash/Redis REST URL for distributed rate limiting
RATE_LIMIT_REDIS_TOKEN=    # Optional Upstash/Redis REST token
```

## MongoDB Atlas & TTL Index Setup

1. Create a fresh least-privilege MongoDB Atlas database user scoped strictly to `readWrite` on database `exhaust`. Never reuse previously exposed credentials.
2. On startup, `server.ts` connects to `exhaust` and calls `ScanModel.syncIndexes()` to ensure the `createdAt` TTL index (`expireAfterSeconds: 7200`).
3. Verify the index directly in Atlas Data Explorer or `mongosh`:
   ```js
   use exhaust
   db.scans.getIndexes()
   // Confirm { key: { createdAt: 1 }, expireAfterSeconds: 7200 }
   ```
4. Check `GET /api/health` or the **Settings** view inside EXHAUST to confirm `databaseConnected: true` and `ttlIndexVerified: true`.

## Production Build & Start

```bash
npm run build
npm start
```
