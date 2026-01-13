/**
 * Response helpers for qerrors module
 *
 * This module provides utilities for handling HTTP responses in Express applications.
 */
// Placeholder implementation - will be expanded later
export const sendJsonResponse = (res, status, data) => {
    return res.status(status).json(data);
};
export const sendSuccessResponse = (res, data, _options) => {
    return res.status(200).json(data);
};
export const sendCreatedResponse = (res, data) => {
    return res.status(201).json(data);
};
export const sendErrorResponse = (res, status, message, details, _options) => {
    return res.status(status).json({ error: message, details });
};
export const sendValidationErrorResponse = (res, errors, _options) => {
    return res.status(400).json({ error: 'Validation failed', errors });
};
export const sendNotFoundResponse = (res, message) => {
    return res.status(404).json({ error: message || 'Not found' });
};
export const sendUnauthorizedResponse = (res, message) => {
    return res.status(401).json({ error: message || 'Unauthorized' });
};
export const sendForbiddenResponse = (res, message) => {
    return res.status(403).json({ error: message || 'Forbidden' });
};
export const sendServerErrorResponse = (res, message) => {
    return res.status(500).json({ error: message || 'Internal server error' });
};
export const createResponseHelper = (res, _startTime) => ({
    success: (data, options) => sendSuccessResponse(res, data, options),
    created: (data) => sendCreatedResponse(res, data),
    error: (status, message, details, options) => sendErrorResponse(res, status, message, details, options),
    notFound: (message) => sendNotFoundResponse(res, message),
    unauthorized: (message) => sendUnauthorizedResponse(res, message),
    forbidden: (message) => sendForbiddenResponse(res, message),
    serverError: (message) => sendServerErrorResponse(res, message)
});
export const globalErrorHandler = (err, _req, res, _next) => {
    console.error('Global error:', err);
    sendErrorResponse(res, 500, 'Internal server error');
};
//# sourceMappingURL=responseHelpers.js.map