import { buildErrorResponse, AppError } from '../utils/errors.js';

export function errorHandler(err, req, res, _next) {
  if (err.name === 'ValidationError') {
    const fieldErrors = Object.entries(err.errors || {}).map(([field, e]) => ({
      field,
      message: e.message,
    }));
    err = AppError.badRequest('VALIDATION_ERROR', 'Validation failed', fieldErrors);
  }
  if (err.name === 'CastError') {
    err = AppError.badRequest('VALIDATION_ERROR', `Invalid value for parameter '${err.path}'`);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    err = AppError.conflict(`${field} is already in use`);
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error('Unhandled error:', err);
  }

  res.status(status).json(buildErrorResponse(err, req.originalUrl));
}

export function notFoundHandler(req, res) {
  res.status(404).json(buildErrorResponse(
    AppError.notFound('Resource not found'),
    req.originalUrl,
  ));
}
