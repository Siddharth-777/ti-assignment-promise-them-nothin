const Redis = require('ioredis');
const { sendRequest } = require('../lib/httpClient');
const { pickRandomPort } = require('../lib/nodeRouter');

const CUSTOMER = 'test-boundary';
const LIMIT = 10;

async function run() {
  const redis = new Redis({ host: 'localhost', port: 6379, lazyConnect: true });
  try {
    await redis.connect();
    await redis.del(`ratelimit:${CUSTOMER}`);
  } finally {
    await redis.quit();
  }

  const log = [];

  for (let i = 1; i <= LIMIT; i++) {
    const port = pickRandomPort();
    const res = await sendRequest(port, CUSTOMER);
    log.push({ request: i, port, status: res.status });
    if (res.status !== 200) {
      return {
        name: 'Three-node enforcement (10 RPM)',
        pass: false,
        detail: `request ${i} on port ${port} returned ${res.status}, expected 200 | breakdown: ${JSON.stringify(log)}`,
      };
    }
  }

  const eleventhPort = pickRandomPort();
  const rejected = await sendRequest(eleventhPort, CUSTOMER);
  log.push({ request: 11, port: eleventhPort, status: rejected.status });

  if (rejected.status !== 429) {
    return {
      name: 'Three-node enforcement (10 RPM)',
      pass: false,
      detail: `request 11 on port ${eleventhPort} returned ${rejected.status}, expected 429 | breakdown: ${JSON.stringify(log)}`,
    };
  }

  const portCounts = {};
  for (const entry of log.slice(0, LIMIT)) {
    portCounts[entry.port] = (portCounts[entry.port] || 0) + 1;
  }

  const leastUsedPort = Number(
    Object.entries(portCounts).sort((a, b) => a[1] - b[1])[0][0]
  );

  const leastUsedRes = await sendRequest(leastUsedPort, CUSTOMER);
  log.push({ request: 12, port: leastUsedPort, status: leastUsedRes.status, note: 'least-used port' });

  if (leastUsedRes.status !== 429) {
    return {
      name: 'Three-node enforcement (10 RPM)',
      pass: false,
      detail: `request 12 on least-used port ${leastUsedPort} returned ${leastUsedRes.status}, expected 429 | breakdown: ${JSON.stringify(log)}`,
    };
  }

  return {
    name: 'Three-node enforcement (10 RPM)',
    pass: true,
    detail: `port distribution: ${JSON.stringify(portCounts)}`,
  };
}

module.exports = run;
