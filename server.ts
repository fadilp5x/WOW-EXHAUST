import 'dotenv/config';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { initDatabase } from './src/server/database/mongo.ts';
import { createApiRouter } from './src/server/routes/api.ts';

const PORT = Number(process.env.PORT ?? 3000);
const isProduction =
  process.env.NODE_ENV === 'production' || Boolean(process.env.K_SERVICE);

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Allow base64 image payload strictly on consented visual inspection; keep 256kb everywhere else
  app.use('/api/visual-inspect', express.json({ limit: '6mb' }));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.use('/api', createApiRouter());

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EXHAUST server listening on http://0.0.0.0:${PORT}`);
    // Initialize MongoDB connection & TTL index in background so HTTP healthchecks never stall
    void initDatabase();
  });
}

startServer().catch((err) => {
  console.error('Failed to start EXHAUST server:', err);
  process.exit(1);
});
