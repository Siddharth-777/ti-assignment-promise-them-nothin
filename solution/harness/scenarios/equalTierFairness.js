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
    const resA = await sendRequest(pickRandomPort(), CUSTOMER_A);
    if (resA.status !== 200) {
      return {
        name: 'Equal-tier fairness (10 RPM each)',
        pass: false,
        detail: `customer=${CUSTOMER_A} request=${i} expected=200 actual=${resA.status}`,
      };
    }
    if (resA.headers['x-ratelimit-limit'] !== '10') {
      return {
        name: 'Equal-tier fairness (10 RPM each)',
        pass: false,
        detail: `customer=${CUSTOMER_A} request=${i} X-RateLimit-Limit expected="10" actual="${resA.headers['x-ratelimit-limit']}"`,
      };
    }

    const resB = await sendRequest(pickRandomPort(), CUSTOMER_B);
    if (resB.status !== 200) {
      return {
        name: 'Equal-tier fairness (10 RPM each)',
        pass: false,
        detail: `customer=${CUSTOMER_B} request=${i} expected=200 actual=${resB.status}`,
      };
    }
    if (resB.headers['x-ratelimit-limit'] !== '10') {
      return {
        name: 'Equal-tier fairness (10 RPM each)',
        pass: false,
        detail: `customer=${CUSTOMER_B} request=${i} X-RateLimit-Limit expected="10" actual="${resB.headers['x-ratelimit-limit']}"`,
      };
    }
  }

  const rejA = await sendRequest(pickRandomPort(), CUSTOMER_A);
  if (rejA.status !== 429) {
    return {
      name: 'Equal-tier fairness (10 RPM each)',
      pass: false,
      detail: `customer=${CUSTOMER_A} request=11 expected=429 actual=${rejA.status}`,
    };
  }
  if (rejA.headers['x-ratelimit-limit'] !== '10') {
    return {
      name: 'Equal-tier fairness (10 RPM each)',
      pass: false,
      detail: `customer=${CUSTOMER_A} request=11 X-RateLimit-Limit expected="10" actual="${rejA.headers['x-ratelimit-limit']}"`,
    };
  }

  const rejB = await sendRequest(pickRandomPort(), CUSTOMER_B);
  if (rejB.status !== 429) {
    return {
      name: 'Equal-tier fairness (10 RPM each)',
      pass: false,
      detail: `customer=${CUSTOMER_B} request=11 expected=429 actual=${rejB.status}`,
    };
  }
  if (rejB.headers['x-ratelimit-limit'] !== '10') {
    return {
      name: 'Equal-tier fairness (10 RPM each)',
      pass: false,
      detail: `customer=${CUSTOMER_B} request=11 X-RateLimit-Limit expected="10" actual="${rejB.headers['x-ratelimit-limit']}"`,
    };
  }

  return { name: 'Equal-tier fairness (10 RPM each)', pass: true, detail: '' };
}

module.exports = run;
