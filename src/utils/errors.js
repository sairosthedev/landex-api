export class AppError extends Error {
  constructor(status, code, message, fieldErrors = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  static badRequest(code, message, fieldErrors) {
    return new AppError(400, code || 'VALIDATION_ERROR', message, fieldErrors);
  }

  static unauthorized(message = 'Invalid email or password') {
    return new AppError(401, 'INVALID_CREDENTIALS', message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, 'ACCESS_DENIED', message);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message) {
    return new AppError(409, 'CONFLICT', message);
  }

  static accountLocked(message) {
    return new AppError(403, 'ACCOUNT_LOCKED', message);
  }
}

export function buildErrorResponse(err, path) {
  const status = err.status || 500;
  const errorNames = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    500: 'Internal Server Error',
  };
  return {
    timestamp: new Date().toISOString(),
    status,
    error: errorNames[status] || 'Error',
    code: err.code || 'INTERNAL_ERROR',
    message: err.message || 'An unexpected error occurred',
    path,
    fieldErrors: err.fieldErrors || undefined,
  };
}
