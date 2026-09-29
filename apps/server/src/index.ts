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
  origin: [config.corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

const uploadsDirectory = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}

app.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadsDirectory, req.path);
  if (!fs.existsSync(filePath)) {
    if (req.path.match(/\.(png|jpg|jpeg|svg|webp)$/i)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(`
        <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="#f1f5f9">
          <rect width="300" height="200" fill="#e2e8f0"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#64748b">Nexis Asset Placeholder</text>
        </svg>
      `);
    }
  }
  next();
}, express.static(uploadsDirectory));

app.use('/api/v1', routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`🚀 Nexis Fintech Core API Server running on port ${config.port}`);
  console.log(`📡 Base URL: http://localhost:${config.port}/api/v1`);
  console.log(`📂 Uploads Volume: ${uploadsDirectory}`);
  console.log(`🔒 Environment: ${config.nodeEnv}`);
  console.log(`====================================================`);
  
  // Register automated financial background cron jobs
  returnsJobService.startScheduler();
});

export default app;
