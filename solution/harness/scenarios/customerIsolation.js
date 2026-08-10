const Redis = require('ioredis');
const { sendRequest } = require('../lib/httpClient');
const { pickRandomPort } = require('../lib/nodeRouter');

const CUSTOMER_A = 'test-boundary';
const CUSTOMER_B = 'test-isolation-b';
const LIMIT = 10;

async function run() {
  const redis = new Redis({ host: 'localhost', port: 6379, lazyConnect: true });
  try {
    await redis.connect();
    await redis.del(`ratelimit:${CUSTOMER_A}`);
    await redis.del(`ratelimit:${CUSTOMER_B}`);
  } finally {
    await redis.quit();
  }

  for (let i = 1; i <= LIMIT; i++) {
    const res = await sendRequest(pickRandomPort(), CUSTOMER_A);
    if (res.status !== 200) {
      return {
        name: 'Customer isolation (10 RPM each)',
        pass: false,
        detail: `customer=${CUSTOMER_A} request=${i} expected=200 actual=${res.status}`,
      };
    }
  }

  const rejectedA = await sendRequest(pickRandomPort(), CUSTOMER_A);
  if (rejectedA.status !== 429) {
    return {
      name: 'Customer isolation (10 RPM each)',
      pass: false,
      detail: `customer=${CUSTOMER_A} request=11 expected=429 actual=${rejectedA.status}`,
    };
  }

  for (let i = 1; i <= 5; i++) {
    const res = await sendRequest(pickRandomPort(), CUSTOMER_B);
    if (res.status !== 200) {
      return {
        name: 'Customer isolation (10 RPM each)',
        pass: false,
        detail: `customer=${CUSTOMER_B} request=${i} expected=200 actual=${res.status}`,
      };
    }
  }

  const finalA = await sendRequest(pickRandomPort(), CUSTOMER_A);
  if (finalA.status !== 429) {
    return {
      name: 'Customer isolation (10 RPM each)',
      pass: false,
      detail: `customer=${CUSTOMER_A} request=12 expected=429 actual=${finalA.status} (after ${CUSTOMER_B} traffic)`,
    };
  }

  return { name: 'Customer isolation (10 RPM each)', pass: true, detail: '' };
}

module.exports = run;
