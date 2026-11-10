import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000/api/v1',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'ditya-group-jwt-secret-key-at-least-32-chars-random-production',
  adminJwtSecret: process.env.ADMIN_JWT_SECRET || 'ditya-group-jwt-secret-key-at-least-32-chars-random-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  email: {
    user: (process.env.EMAIL_USER || 'gnbmailsender@gmail.com').trim(),
    pass: (process.env.EMAIL_PASS || '').trim(),
    host: (process.env.EMAIL_HOST || 'smtp.gmail.com').trim(),
    port: Number(process.env.EMAIL_PORT) || 587,
    from: process.env.EMAIL_FROM || 'Avora Bank <gnbmailsender@gmail.com>',
    adminNotify: (process.env.ADMIN_NOTIFICATION_EMAIL || 'gnbmailsender@gmail.com').trim(),
  },
  uploadDir: process.env.UPLOAD_DIR || './uploads',
};
