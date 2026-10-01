import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message);

  res.status(500).json({
    success: false,
    error: err.message || 'An unexpected error occurred. Please try again.'
  });
}
