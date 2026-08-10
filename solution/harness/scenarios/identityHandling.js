const Redis = require('ioredis');
const { sendRequest } = require('../lib/httpClient');

const PORT = 3001;
const UNKNOWN_CUSTOMER = 'definitely-not-a-real-customer';
const KNOWN_CUSTOMER = 'test-boundary';
const NAME = 'Identity handling (401/403)';

async function run() {
  const redis = new Redis({ host: 'localhost', port: 6379, lazyConnect: true });
  try {
    await redis.connect();

    const keysBefore = await redis.keys('ratelimit:*');

    const missingHeaderRes = await sendRequest(PORT);
    if (missingHeaderRes.status !== 401) {
      return {
        name: NAME,
        pass: false,
        detail: `missing header: expected 401, got ${missingHeaderRes.status}`,
      };
    }

    const keysAfterMissing = await redis.keys('ratelimit:*');
    const newKeysAfterMissing = keysAfterMissing.filter((k) => !keysBefore.includes(k));
    if (newKeysAfterMissing.length > 0) {
      return {
        name: NAME,
        pass: false,
        detail: `missing header: unexpected Redis keys created: ${newKeysAfterMissing.join(', ')}`,
      };
    }

    const unknownRes = await sendRequest(PORT, UNKNOWN_CUSTOMER);
    if (unknownRes.status !== 403) {
      return {
        name: NAME,
        pass: false,
        detail: `unknown customer: expected 403, got ${unknownRes.status}`,
      };
    }

    const unknownKeyExists = await redis.exists(`ratelimit:${UNKNOWN_CUSTOMER}`);
    if (unknownKeyExists) {
      return {
        name: NAME,
        pass: false,
        detail: `unknown customer: Redis key ratelimit:${UNKNOWN_CUSTOMER} should not exist`,
      };
    }

    await redis.del(`ratelimit:${KNOWN_CUSTOMER}`);

    const knownRes = await sendRequest(PORT, KNOWN_CUSTOMER);
    if (knownRes.status !== 200) {
      return {
        name: NAME,
        pass: false,
        detail: `sanity check: expected 200 for known customer, got ${knownRes.status}`,
      };
    }

    const knownKeyExists = await redis.exists(`ratelimit:${KNOWN_CUSTOMER}`);
    if (!knownKeyExists) {
      return {
        name: NAME,
        pass: false,
        detail: `sanity check: Redis key ratelimit:${KNOWN_CUSTOMER} should exist after 200 response`,
      };
    }

    return { name: NAME, pass: true, detail: '' };
  } finally {
    await redis.quit();
  }
}

module.exports = run;
