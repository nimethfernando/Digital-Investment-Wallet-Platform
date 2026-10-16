import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/error';
import { returnsJobService } from './services/returns.job';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: [config.corsOrigin, 'http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true,
}));

app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDirectory = isServerless
  ? path.join('/tmp', 'uploads')
  : path.resolve(config.uploadDir);

try {
  if (!fs.existsSync(uploadsDirectory)) {
    fs.mkdirSync(uploadsDirectory, { recursive: true });
  }
} catch (err) {
  console.warn('[Server] Note on uploads directory creation:', err);
}

app.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadsDirectory, req.path);
  if (!fs.existsSync(filePath)) {
    if (req.path.match(/\.(png|jpg|jpeg|svg|webp)$/i)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(`
        <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="#f1f5f9">
          <rect width="300" height="200" fill="#e2e8f0"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#64748b">Avora Bank Asset Placeholder</text>
        </svg>
      `);
    }
  }
  next();
}, express.static(uploadsDirectory));

// Robust Health & Diagnostic Endpoint (runs without requiring DB access)
app.get(['/health', '/api/health', '/api/v1/health'], (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Avora Bank Core API Engine',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    isServerless,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  });
});

app.use('/api/v1', routes);
app.use('/v1', routes);
app.use('/api', routes);
app.use('/', routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

const port = process.env.PORT || config.port || 5000;

// Listen when started directly, with PORT specified, or in non-serverless mode
if (process.env.PORT || (!isServerless && process.env.NODE_ENV !== 'test')) {
  try {
    app.listen(port, () => {
      console.log(`====================================================`);
      console.log(`🚀 Avora Bank Core API Server running on port ${port}`);
      console.log(`📡 Base URL: http://localhost:${port}/api/v1`);
      console.log(`📂 Uploads Volume: ${uploadsDirectory}`);
      console.log(`🔒 Environment: ${config.nodeEnv}`);
      console.log(`====================================================`);
      
      // Register automated financial background cron jobs
      returnsJobService.startScheduler();
    });
  } catch (err: any) {
    console.warn('[Server] Listen notice:', err.message);
  }
}

const handler = (req: any, res: any) => {
  return app(req, res);
};

export default handler;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  (module.exports as any).default = handler;
  (module.exports as any).app = app;
}
