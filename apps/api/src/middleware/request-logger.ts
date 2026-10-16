import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface RequestWithCorrelation extends Request {
  correlationId?: string;
  startTime?: number;
}

export function requestLogger(req: RequestWithCorrelation, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || `req-${crypto.randomUUID().slice(0, 8)}`;
  req.correlationId = correlationId;
  req.startTime = Date.now();

  res.setHeader('X-Correlation-ID', correlationId);

  res.on('finish', () => {
    const durationMs = Date.now() - (req.startTime || Date.now());
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(
      `[${new Date().toISOString()}] [${level}] [${correlationId}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`
    );
  });

  next();
}
