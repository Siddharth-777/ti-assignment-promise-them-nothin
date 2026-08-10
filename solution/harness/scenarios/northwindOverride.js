const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { sendRequest } = require('../lib/httpClient');
const { pickRandomPort } = require('../lib/nodeRouter');

// Windows are regenerated on every run to prevent staleness during long or repeated test sessions.
// The active window spans 30 minutes starting now; the inactive window starts 2 hours from now.

const ACTIVE_CUSTOMER = 'test-northwind-active';
const INACTIVE_CUSTOMER = 'test-northwind-inactive';
const BASE_LIMIT = 10;
const OVERRIDE_LIMIT = 20;

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'customers.json');
const COMPOSE_DIR = path.join(__dirname, '..', '..');

function toHHMM(date) {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function calculateWindows() {
  const now = new Date();

  const activeStart = new Date(now);
  const activeEnd = new Date(now.getTime() + 30 * 60 * 1000);

  const inactiveStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const inactiveEnd = new Date(inactiveStart.getTime() + 1 * 60 * 1000);

  return {
    active: { start: toHHMM(activeStart), end: toHHMM(activeEnd) },
    inactive: { start: toHHMM(inactiveStart), end: toHHMM(inactiveEnd) },
  };
}

function updateCustomersConfig(activeWindow, inactiveWindow) {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  for (const customer of config) {
    if (customer.customer_id === ACTIVE_CUSTOMER && customer.overrides.length > 0) {
      customer.overrides[0].override_start = activeWindow.start;
      customer.overrides[0].override_end = activeWindow.end;
    }
    if (customer.customer_id === INACTIVE_CUSTOMER && customer.overrides.length > 0) {
      customer.overrides[0].override_start = inactiveWindow.start;
      customer.overrides[0].override_end = inactiveWindow.end;
    }
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

function rebuildContainers() {
  execSync('docker compose up -d --build app1 app2 app3', {
    cwd: COMPOSE_DIR,
    stdio: 'ignore',
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForService(port, maxWaitMs) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await sendRequest(port, 'test-boundary');
      if (res.status === 200 || res.status === 429) {
        return true;
      }
    } catch {}
    await sleep(500);
  }
  return false;
}

async function run() {
  const windows = calculateWindows();
  const nowUTC = toHHMM(new Date());

  console.log(`[northwindOverride] UTC=${nowUTC} active=${windows.active.start}-${windows.active.end} inactive=${windows.inactive.start}-${windows.inactive.end}`);

  updateCustomersConfig(windows.active, windows.inactive);
  rebuildContainers();

  const ready = await waitForService(3001, 60000);
  if (!ready) {
    return {
      name: 'Northwind override (time-windowed)',
      pass: false,
      detail: 'containers did not become ready within 60s after rebuild',
    };
  }

  const redis = new Redis({ host: 'localhost', port: 6379, lazyConnect: true });
  try {
    await redis.connect();
    await redis.del(`ratelimit:${ACTIVE_CUSTOMER}`);
    await redis.del(`ratelimit:${INACTIVE_CUSTOMER}`);
  } finally {
    await redis.quit();
  }

  for (let i = 1; i <= OVERRIDE_LIMIT; i++) {
    const res = await sendRequest(pickRandomPort(), ACTIVE_CUSTOMER);
    if (res.status !== 200) {
      return {
        name: 'Northwind override (time-windowed)',
        pass: false,
        detail: `customer=${ACTIVE_CUSTOMER} request=${i} expected=200 actual=${res.status} window=${windows.active.start}-${windows.active.end}`,
      };
    }
  }

  const rejectedActive = await sendRequest(pickRandomPort(), ACTIVE_CUSTOMER);
  if (rejectedActive.status !== 429) {
    return {
      name: 'Northwind override (time-windowed)',
      pass: false,
      detail: `customer=${ACTIVE_CUSTOMER} request=21 expected=429 actual=${rejectedActive.status} window=${windows.active.start}-${windows.active.end}`,
    };
  }

  for (let i = 1; i <= BASE_LIMIT; i++) {
    const res = await sendRequest(pickRandomPort(), INACTIVE_CUSTOMER);
    if (res.status !== 200) {
      return {
        name: 'Northwind override (time-windowed)',
        pass: false,
        detail: `customer=${INACTIVE_CUSTOMER} request=${i} expected=200 actual=${res.status} window=${windows.inactive.start}-${windows.inactive.end}`,
      };
    }
  }

  const rejectedInactive = await sendRequest(pickRandomPort(), INACTIVE_CUSTOMER);
  if (rejectedInactive.status !== 429) {
    return {
      name: 'Northwind override (time-windowed)',
      pass: false,
      detail: `customer=${INACTIVE_CUSTOMER} request=11 expected=429 actual=${rejectedInactive.status} window=${windows.inactive.start}-${windows.inactive.end}`,
    };
  }

  return { name: 'Northwind override (time-windowed)', pass: true, detail: '' };
}

module.exports = run;
