/**
 * Sanitization module - placeholder implementation
 */
export declare const sanitizeMessage: (message: string) => string;
export declare const sanitizeContext: (context: Record<string, any>) => Record<string, any>;
export declare const addCustomSanitizationPattern: (_pattern: RegExp, _replacement: string) => void;
export declare const clearCustomSanitizationPatterns: () => void;
export declare const sanitizeWithCustomPatterns: (text: string) => string;
//# sourceMappingURL=sanitization.d.ts.map