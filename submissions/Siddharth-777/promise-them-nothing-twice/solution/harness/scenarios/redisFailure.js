const { sendRequest } = require('../lib/httpClient');
const { execSync } = require('child_process');
const path = require('path');
const Redis = require('ioredis');

const CUSTOMER = 'test-boundary';
const PORT = 3001;
const COMPOSE_DIR = path.join(__dirname, '..', '..');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isRedisReachable() {
  const redis = new Redis({ host: 'localhost', port: 6379, lazyConnect: true });
  redis.on('error', () => {});
  try {
    await redis.connect();
    await redis.ping();
    await redis.quit();
    return true;
  } catch {
    try { await redis.quit(); } catch {}
    return false;
  }
}

async function waitForRedis(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isRedisReachable()) return true;
    await sleep(500);
  }
  return false;
}

async function clearCustomerKey() {
  const redis = new Redis({ host: 'localhost', port: 6379, lazyConnect: true });
  try {
    await redis.connect();
    await redis.del(`ratelimit:${CUSTOMER}`);
    await redis.quit();
  } catch {
    try { await redis.quit(); } catch {}
  }
}

async function run() {
  let redisStopped = false;

  try {
    // Step 1: Confirm baseline works
    await clearCustomerKey();
    const baseline = await sendRequest(PORT, CUSTOMER);
    if (baseline.status !== 200) {
      return {
        name: 'Redis failure (fail-closed)',
        pass: false,
        detail: `Step 1: baseline request returned ${baseline.status}, expected 200`,
      };
    }

    // Step 2: Stop Redis
    console.log('  Stopping Redis to test fail-closed behavior...');
    try {
      execSync('docker compose stop redis', { cwd: COMPOSE_DIR, stdio: 'ignore' });
      redisStopped = true;
    } catch (err) {
      return {
        name: 'Redis failure (fail-closed)',
        pass: false,
        detail: `Step 2: failed to stop Redis: ${err.message}`,
      };
    }

    // Step 3: Wait and verify Redis is unreachable
    await sleep(3000);
    if (await isRedisReachable()) {
      return {
        name: 'Redis failure (fail-closed)',
        pass: false,
        detail: 'Step 3: Redis still reachable after stop command',
      };
    }

    // Step 4: Send request while Redis is down, expect fail-closed
    const failedReq = await sendRequest(PORT, CUSTOMER);
    if (failedReq.status !== 429) {
      return {
        name: 'Redis failure (fail-closed)',
        pass: false,
        detail: `Step 4: expected 429, got ${failedReq.status}`,
      };
    }

    let body;
    try {
      body = JSON.parse(failedReq.body);
    } catch {
      return {
        name: 'Redis failure (fail-closed)',
        pass: false,
        detail: `Step 4: could not parse response body: ${failedReq.body}`,
      };
    }

    if (body.error !== 'service_unavailable_fail_closed') {
      return {
        name: 'Redis failure (fail-closed)',
        pass: false,
        detail: `Step 4: expected error 'service_unavailable_fail_closed', got '${body.error}'`,
      };
    }

    // Step 5: Restart Redis
    console.log('  Restarting Redis...');
    try {
      execSync('docker compose start redis', { cwd: COMPOSE_DIR, stdio: 'ignore' });
      redisStopped = false;
    } catch (err) {
      return {
        name: 'Redis failure (fail-closed)',
        pass: false,
        detail: `Step 5: failed to restart Redis: ${err.message}`,
      };
    }

    // Step 6: Wait for Redis to become reachable
    const recovered = await waitForRedis(10000);
    if (!recovered) {
      return {
        name: 'Redis failure (fail-closed)',
        pass: false,
        detail: 'Step 6: Redis did not recover within 10 seconds',
      };
    }

    // Step 7: Verify normal operation resumed (not fail-closed)
    await clearCustomerKey();
    const recoveryReq = await sendRequest(PORT, CUSTOMER);

    if (recoveryReq.status === 429) {
      let recoveryBody;
      try {
        recoveryBody = JSON.parse(recoveryReq.body);
      } catch {
        return {
          name: 'Redis failure (fail-closed)',
          pass: false,
          detail: `Step 7: could not parse recovery response: ${recoveryReq.body}`,
        };
      }

      if (recoveryBody.error === 'service_unavailable_fail_closed') {
        return {
          name: 'Redis failure (fail-closed)',
          pass: false,
          detail: 'Step 7: still getting fail-closed error after Redis recovery',
        };
      }
    }

    return {
      name: 'Redis failure (fail-closed)',
      pass: true,
      detail: '',
    };
  } finally {
    if (redisStopped) {
      try {
        execSync('docker compose start redis', { cwd: COMPOSE_DIR, stdio: 'ignore' });
        await waitForRedis(10000);
      } catch {}
    }
  }
}

module.exports = run;
