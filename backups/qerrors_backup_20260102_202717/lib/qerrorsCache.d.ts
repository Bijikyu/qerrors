export function clearAdviceCache(): void;
export function purgeExpiredAdvice(): void;
export function startAdviceCleanup(): void;
export function stopAdviceCleanup(): void;
export function getAdviceFromCache(key: any): {} | undefined;
export function setAdviceInCache(key: any, advice: any): void;
export function adjustCacheSize(): void;
export function getCacheStats(): {
    size: number;
    maxSize: number;
    memoryPressure: any;
    memoryUsage: any;
    hitRate: number;
};
export function calculateMemoryAwareCacheSize(): number;
//# sourceMappingURL=qerrorsCache.d.ts.map