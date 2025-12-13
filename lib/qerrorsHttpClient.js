'use strict';

const axios = require('axios');
const http = require('http');
const https = require('https');
const config = require('./config');
const { MAX_SOCKETS, MAX_FREE_SOCKETS } = require('./qerrorsConfig');

const axiosInstance = axios.create({
  httpAgent: new http.Agent({
    keepAlive: true,
    maxSockets: MAX_SOCKETS,
    maxFreeSockets: MAX_FREE_SOCKETS
  }),
  httpsAgent: new https.Agent({
    keepAlive: true,
    maxSockets: MAX_SOCKETS,
    maxFreeSockets: MAX_FREE_SOCKETS
  }),
  timeout: config.getInt('QERRORS_TIMEOUT')
});

async function postWithRetry(url, data, opts, capMs) {
  const retries = config.getInt('QERRORS_RETRY_ATTEMPTS');
  const base = config.getInt('QERRORS_RETRY_BASE_MS');
  const cap = capMs !== undefined ? capMs : config.getInt('QERRORS_RETRY_MAX_MS', 0);
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await axiosInstance.post(url, data, opts);
    } catch (err) {
      if (i >= retries) throw err;
      
      const jitter = Math.random() * base;
      let wait = base * 2 ** i + jitter;
      
      if (err.response && (err.response.status === 429 || err.response.status === 503)) {
        const retryAfter = err.response.headers?.['retry-after'];
        if (retryAfter) {
          const secs = Number(retryAfter);
          if (!Number.isNaN(secs)) {
            wait = secs * 1000;
          } else {
            const date = Date.parse(retryAfter);
            if (!Number.isNaN(date)) {
              wait = date - Date.now();
            }
          }
        } else {
          wait *= 2;
        }
      }
      
      if (cap > 0 && wait > cap) {
        wait = cap;
      }
      
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

module.exports = {
  axiosInstance,
  postWithRetry
};