const Redis = require('ioredis');
const { sendRequest } = require('../lib/httpClient');

const CUSTOMER = 'test-boundary';
const PORT = 3001;
const LIMIT = 10;
const WINDOW_MS = 60000;

async function run() {
  const redis = new Redis({ host: 'localhost', port: 6379, lazyConnect: true });
  try {
    await redis.connect();
    await redis.del(`ratelimit:${CUSTOMER}`);
  } finally {
    await redis.quit();
  }

  const firstRequestTime = Date.now();
  const r1 = await sendRequest(PORT, CUSTOMER);
  if (r1.status !== 200) {
    return {
      name: 'Rolling expiration (10 RPM)',
      pass: false,
      detail: `step 1: request 1 returned ${r1.status}, expected 200`,
    };
  }

  await new Promise((r) => setTimeout(r, 2000));

  for (let i = 2; i <= LIMIT; i++) {
    const res = await sendRequest(PORT, CUSTOMER);
    if (res.status !== 200) {
      return {
        name: 'Rolling expiration (10 RPM)',
        pass: false,
        detail: `step 1: request ${i} returned ${res.status}, expected 200`,
      };
    }
  }

  const rejected = await sendRequest(PORT, CUSTOMER);
  if (rejected.status !== 429) {
    return {
      name: 'Rolling expiration (10 RPM)',
      pass: false,
      detail: `step 2: request 11 returned ${rejected.status}, expected 429`,
    };
  }

  const elapsed = Date.now() - firstRequestTime;
  // 500ms margin absorbs clock drift, network latency, and scheduling jitter between
  // Date.now() and Redis TIME. Safe: well under the 2s stagger before requests 2–10 expire.
  const waitMs = WINDOW_MS - elapsed + 500;
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }

  const afterExpiry = await sendRequest(PORT, CUSTOMER);
  if (afterExpiry.status !== 200) {
    return {
      name: 'Rolling expiration (10 RPM)',
      pass: false,
      detail: `step 4: request 12 returned ${afterExpiry.status}, expected 200 after window expiry`,
    };
  }

  const shouldReject = await sendRequest(PORT, CUSTOMER);
  if (shouldReject.status !== 429) {
    return {
      name: 'Rolling expiration (10 RPM)',
      pass: false,
      detail: `step 5: request 13 returned ${shouldReject.status}, expected 429 (slot already consumed)`,
    };
  }

  return { name: 'Rolling expiration (10 RPM)', pass: true, detail: '' };
}

module.exports = run;
