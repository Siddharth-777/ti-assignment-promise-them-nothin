// Sole module that imports ioredis. No other file may require/import ioredis.

const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
});

redis.on('error', (err) => {
  // TODO: replace with src/logger.js once it exposes a real logging function
  console.error('[redis-client] connection error (non-fatal):', err.message);
});

const luaScript = fs.readFileSync(path.join(__dirname, 'limiter.lua'), 'utf8');

redis.defineCommand('checkAndRecord', {
  numberOfKeys: 1,
  lua: luaScript,
});

async function checkRateLimit(customerId, baseLimit, overrideLimit, overrideStart, overrideEnd, windowSize) {
  const key = `ratelimit:${customerId}`;
  try {
    const result = await redis.checkAndRecord(key, baseLimit, overrideLimit, overrideStart, overrideEnd, windowSize);
    return {
      allowed: result[0] === 1,
      currentCount: result[1],
      effectiveLimit: result[2],
      retryAfter: result[3],
      nowSeconds: result[4],
      nowMicroseconds: result[5],
    };
  } catch (err) {
    throw err;
  }
}

module.exports = { redis, checkRateLimit };
