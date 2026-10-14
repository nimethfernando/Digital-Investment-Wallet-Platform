import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('[API Error]:', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    });
    return;
  }

  if (err.code === 'P2002') {
    res.status(409).json({
      success: false,
      message: 'An account or record with this unique identifier already exists.',
    });
    return;
  }

  let statusCode = err.status || err.statusCode;
  const message = err.message || 'Internal Server Error';

  if (!statusCode) {
    if (message.includes('already exists') || message.includes('already registered')) {
      statusCode = 409;
    } else if (message.includes('Invalid email') || message.includes('Invalid 2FA') || message.includes('authentication')) {
      statusCode = 401;
    } else if (message.includes('suspended') || message.includes('locked')) {
      statusCode = 403;
    } else if (message.includes('required') || message.includes('not found') || message.includes('expired')) {
      statusCode = 400;
    } else {
      statusCode = 500;
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
};
