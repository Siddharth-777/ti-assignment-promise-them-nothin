const Redis = require('ioredis');
const { sendRequest } = require('../lib/httpClient');

const CUSTOMER = 'test-boundary';
const PORT = 3001;
const LIMIT = 10;
const TOLERANCE = 2;

async function run() {
  const redis = new Redis({ host: 'localhost', port: 6379, lazyConnect: true });
  try {
    await redis.connect();
    await redis.del(`ratelimit:${CUSTOMER}`);
  } finally {
    await redis.quit();
  }

  const t0 = Date.now();

  for (let i = 1; i <= LIMIT; i++) {
    const res = await sendRequest(PORT, CUSTOMER);
    if (res.status !== 200) {
      return {
        name: 'Retry-After accuracy',
        pass: false,
        detail: `request ${i} returned ${res.status}, expected 200`,
      };
    }
  }

  // Wait 5s so Retry-After diverges from 60 — a hardcoded value would fail here
  await new Promise((r) => setTimeout(r, 5000));

  const rejected = await sendRequest(PORT, CUSTOMER);

  if (rejected.status !== 429) {
    return {
      name: 'Retry-After accuracy',
      pass: false,
      detail: `request ${LIMIT + 1} returned ${rejected.status}, expected 429`,
    };
  }

  const retryAfter = Number(rejected.headers['retry-after']);

  if (!Number.isInteger(retryAfter) || retryAfter <= 0) {
    return {
      name: 'Retry-After accuracy',
      pass: false,
      detail: `Retry-After missing or invalid (got: "${rejected.headers['retry-after']}")`,
    };
  }

  const elapsedMs = Date.now() - t0;
  const expected = Math.ceil(60 - elapsedMs / 1000);

  if (retryAfter === 60 && expected < 58) {
    return {
      name: 'Retry-After accuracy',
      pass: false,
      detail: `Retry-After looks hardcoded at 60 (expected ~${expected}s given ${elapsedMs}ms elapsed); t0=${t0}`,
    };
  }

  if (retryAfter === 1 && expected > 3) {
    return {
      name: 'Retry-After accuracy',
      pass: false,
      detail: `Retry-After looks hardcoded at 1 (expected ~${expected}s given ${elapsedMs}ms elapsed); t0=${t0}`,
    };
  }
  const diff = Math.abs(retryAfter - expected);

  if (diff > TOLERANCE) {
    return {
      name: 'Retry-After accuracy',
      pass: false,
      detail: `actual=${retryAfter}s expected=${expected}s diff=${diff}s tolerance=±${TOLERANCE}s t0=${t0} elapsed=${elapsedMs}ms`,
    };
  }

  return {
    name: 'Retry-After accuracy',
    pass: true,
    detail: `actual=${retryAfter}s expected=${expected}s diff=${diff}s tolerance=±${TOLERANCE}s elapsed=${elapsedMs}ms`,
  };
}

module.exports = run;
