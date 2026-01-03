/**
 * Response helpers for qerrors module
 *
 * This module provides utilities for handling HTTP responses in Express applications.
 */
export declare const sendJsonResponse: (res: any, status: number, data: any) => any;
export declare const sendSuccessResponse: (res: any, data: any, _options?: any) => any;
export declare const sendCreatedResponse: (res: any, data: any) => any;
export declare const sendErrorResponse: (res: any, status: number, message: string, details?: any, _options?: any) => any;
export declare const sendValidationErrorResponse: (res: any, errors: any[], _options?: any) => any;
export declare const sendNotFoundResponse: (res: any, message?: string) => any;
export declare const sendUnauthorizedResponse: (res: any, message?: string) => any;
export declare const sendForbiddenResponse: (res: any, message?: string) => any;
export declare const sendServerErrorResponse: (res: any, message?: string) => any;
export declare const createResponseHelper: (res: any, _startTime?: number | null) => {
    success: (data: any, options?: any) => any;
    created: (data: any) => any;
    error: (status: number, message: string, details?: any, options?: any) => any;
    notFound: (message?: string) => any;
    unauthorized: (message?: string) => any;
    forbidden: (message?: string) => any;
    serverError: (message?: string) => any;
};
export declare const globalErrorHandler: (err: Error, _req: any, res: any, _next: Function) => void;
//# sourceMappingURL=responseHelpers.d.ts.map