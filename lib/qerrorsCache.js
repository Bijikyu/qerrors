'use strict';

const { LRUCache } = require('lru-cache');
const { ADVICE_CACHE_LIMIT, CACHE_TTL_SECONDS } = require('./qerrorsConfig');

const adviceCache = new LRUCache({
  max: ADVICE_CACHE_LIMIT || 0,
  ttl: CACHE_TTL_SECONDS * 1000
});

let cleanupHandle = null;

const startAdviceCleanup = () => {
  if (CACHE_TTL_SECONDS === 0 || ADVICE_CACHE_LIMIT === 0 || cleanupHandle) return;
  cleanupHandle = setInterval(purgeExpiredAdvice, CACHE_TTL_SECONDS * 1000);
  cleanupHandle.unref();
};

const stopAdviceCleanup = () => {
  cleanupHandle && (clearInterval(cleanupHandle), cleanupHandle = null);
};

const clearAdviceCache = () => {
  adviceCache.clear();
  adviceCache.size === 0 && stopAdviceCleanup();
};

const purgeExpiredAdvice = () => {
  if (CACHE_TTL_SECONDS === 0 || ADVICE_CACHE_LIMIT === 0) return;
  adviceCache.purgeStale();
  adviceCache.size === 0 && stopAdviceCleanup();
};

const getAdviceFromCache = (key) => {
  return adviceCache.get(key);
};

const setAdviceInCache = (key, advice) => {
  if (ADVICE_CACHE_LIMIT !== 0) {
    adviceCache.set(key, advice);
    startAdviceCleanup();
  }
};

module.exports = {
  clearAdviceCache,
  purgeExpiredAdvice,
  startAdviceCleanup,
  stopAdviceCleanup,
  getAdviceFromCache,
  setAdviceInCache
};