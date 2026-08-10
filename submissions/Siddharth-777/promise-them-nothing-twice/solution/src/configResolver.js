const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config', 'customers.json');
const raw = fs.readFileSync(configPath, 'utf8');
const entries = JSON.parse(raw);

const customers = new Map();

for (const entry of entries) {
  if (!entry.customer_id) {
    throw new Error(`Config validation failed: missing customer_id in entry ${JSON.stringify(entry)}`);
  }
  if (entry.base_limit == null) {
    throw new Error(`Config validation failed: missing base_limit for customer "${entry.customer_id}"`);
  }
  if (!Array.isArray(entry.overrides)) {
    throw new Error(`Config validation failed: missing or invalid overrides for customer "${entry.customer_id}"`);
  }
  for (const override of entry.overrides) {
    if (override.override_limit == null) {
      throw new Error(`Config validation failed: missing override_limit in override for customer "${entry.customer_id}"`);
    }
    if (override.override_start == null) {
      throw new Error(`Config validation failed: missing override_start in override for customer "${entry.customer_id}"`);
    }
    if (override.override_end == null) {
      throw new Error(`Config validation failed: missing override_end in override for customer "${entry.customer_id}"`);
    }
  }
  customers.set(entry.customer_id, entry);
}

function timeToSeconds(str) {
  const [hours, minutes] = str.split(':').map(Number);
  return hours * 3600 + minutes * 60;
}

function resolveLimit(customerId) {
  const entry = customers.get(customerId);
  if (!entry) return null;

  if (entry.overrides.length === 0) {
    return {
      baseLimit: entry.base_limit,
      overrideLimit: 0,
      overrideStart: 0,
      overrideEnd: 0,
      windowSize: 60,
    };
  }

  const override = entry.overrides[0];
  return {
    baseLimit: entry.base_limit,
    overrideLimit: override.override_limit,
    overrideStart: timeToSeconds(override.override_start),
    overrideEnd: timeToSeconds(override.override_end),
    windowSize: 60,
  };
}

module.exports = { resolveLimit };
