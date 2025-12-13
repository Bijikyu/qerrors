/**
 * Response helpers for qerrors module
 * 
 * This module provides utilities for handling HTTP responses in Express applications.
 */

// Placeholder implementation - will be expanded later
export const sendJsonResponse = (res: any, status: number, data: any): any => {
  return res.status(status).json(data);
};

export const sendSuccessResponse = (res: any, data: any, _options?: any): any => {
  return res.status(200).json(data);
};

export const sendCreatedResponse = (res: any, data: any): any => {
  return res.status(201).json(data);
};

export const sendErrorResponse = (res: any, status: number, message: string, details?: any, _options?: any): any => {
  return res.status(status).json({ error: message, details });
};

export const sendValidationErrorResponse = (res: any, errors: any[], _options?: any): any => {
  return res.status(400).json({ error: 'Validation failed', errors });
};

export const sendNotFoundResponse = (res: any, message?: string): any => {
  return res.status(404).json({ error: message || 'Not found' });
};

export const sendUnauthorizedResponse = (res: any, message?: string): any => {
  return res.status(401).json({ error: message || 'Unauthorized' });
};

export const sendForbiddenResponse = (res: any, message?: string): any => {
  return res.status(403).json({ error: message || 'Forbidden' });
};

export const sendServerErrorResponse = (res: any, message?: string): any => {
  return res.status(500).json({ error: message || 'Internal server error' });
};

export const createResponseHelper = (res: any, _startTime?: number | null) => ({
  success: (data: any, options?: any) => sendSuccessResponse(res, data, options),
  created: (data: any) => sendCreatedResponse(res, data),
  error: (status: number, message: string, details?: any, options?: any) => sendErrorResponse(res, status, message, details, options),
  notFound: (message?: string) => sendNotFoundResponse(res, message),
  unauthorized: (message?: string) => sendUnauthorizedResponse(res, message),
  forbidden: (message?: string) => sendForbiddenResponse(res, message),
  serverError: (message?: string) => sendServerErrorResponse(res, message)
});

export const globalErrorHandler = (err: Error, _req: any, res: any, _next: Function): void => {
  console.error('Global error:', err);
  sendErrorResponse(res, 500, 'Internal server error');
};