import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten()
    });
  }
  logger.error({ err }, 'unhandled error');
  const status = getErrorStatus(err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
}

function getErrorStatus(error: unknown) {
  if (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status;
  }
  return 500;
}
