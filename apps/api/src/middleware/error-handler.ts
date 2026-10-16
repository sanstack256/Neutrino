import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { RequestWithCorrelation } from './request-logger.js';

export function errorHandler(
  err: any,
  req: RequestWithCorrelation,
  res: Response,
  next: NextFunction
) {
  const correlationId = req.correlationId || 'unknown';

  if (err instanceof ZodError || err?.name === 'ZodError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors || err.issues,
        correlationId,
      },
    });
  }

  const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 500);
  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');

  console.error(`[${new Date().toISOString()}] [ERROR] [${correlationId}]`, err);

  res.status(statusCode).json({
    error: {
      code,
      message: err.message || 'An unexpected error occurred',
      correlationId,
    },
  });
}
