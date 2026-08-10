const Redis = require('ioredis');
const { sendRequest } = require('../lib/httpClient');

const CUSTOMER = 'test-boundary';
const PORT = 3001;
const LIMIT = 10;

async function run() {
  const redis = new Redis({ host: 'localhost', port: 6379, lazyConnect: true });
  try {
    await redis.connect();
    await redis.del(`ratelimit:${CUSTOMER}`);
  } finally {
    await redis.quit();
  }

  for (let i = 1; i <= LIMIT; i++) {
    const res = await sendRequest(PORT, CUSTOMER);
    if (res.status !== 200) {
      return {
        name: 'basicBoundary',
        pass: false,
        detail: `request ${i} returned ${res.status}, expected 200`,
      };
    }
  }

  const rejected = await sendRequest(PORT, CUSTOMER);

  if (rejected.status !== 429) {
    return {
      name: 'basicBoundary',
      pass: false,
      detail: `request ${LIMIT + 1} returned ${rejected.status}, expected 429`,
    };
  }

  const retryAfter = rejected.headers['retry-after'];
  const retryVal = Number(retryAfter);
  if (!retryAfter || !Number.isInteger(retryVal) || retryVal <= 0) {
    return {
      name: 'basicBoundary',
      pass: false,
      detail: `request ${LIMIT + 1} retry-after missing/invalid (got: "${retryAfter}")`,
    };
  }

  return { name: 'basicBoundary', pass: true, detail: '' };
}

module.exports = run;
