const Redis = require('ioredis');
const { sendRequest } = require('../lib/httpClient');
const { pickRandomPort } = require('../lib/nodeRouter');

const CUSTOMER = 'test-boundary';

async function run() {
  const redis = new Redis({ host: 'localhost', port: 6379, lazyConnect: true });
  try {
    await redis.connect();
    await redis.del(`ratelimit:${CUSTOMER}`);
  } finally {
    await redis.quit();
  }

  for (let i = 1; i <= 9; i++) {
    const port = pickRandomPort();
    const res = await sendRequest(port, CUSTOMER);
    if (res.status !== 200) {
      return {
        name: 'Concurrent boundary race (10 RPM)',
        pass: false,
        detail: `sequential request ${i} on port ${port} returned ${res.status}, expected 200`,
      };
    }
  }

  const portA = pickRandomPort();
  const portB = pickRandomPort();
  const [resA, resB] = await Promise.all([
    sendRequest(portA, CUSTOMER),
    sendRequest(portB, CUSTOMER),
  ]);

  const statuses = [resA.status, resB.status].sort();
  const detail = `portA=${portA} status=${resA.status}, portB=${portB} status=${resB.status}`;

  if (statuses[0] === 200 && statuses[1] === 429) {
    return { name: 'Concurrent boundary race (10 RPM)', pass: true, detail };
  }

  if (statuses[0] === 200 && statuses[1] === 200) {
    return { name: 'Concurrent boundary race (10 RPM)', pass: false, detail: `over-admission: both allowed | ${detail}` };
  }

  if (statuses[0] === 429 && statuses[1] === 429) {
    return { name: 'Concurrent boundary race (10 RPM)', pass: false, detail: `false rejection: both rejected | ${detail}` };
  }

  return { name: 'Concurrent boundary race (10 RPM)', pass: false, detail: `unexpected statuses | ${detail}` };
}

module.exports = run;
