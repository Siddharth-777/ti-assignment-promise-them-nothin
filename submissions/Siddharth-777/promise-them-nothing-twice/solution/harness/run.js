const basicBoundary = require('./scenarios/basicBoundary');
const rollingExpiration = require('./scenarios/rollingExpiration');
const threeNodeEnforcement = require('./scenarios/threeNodeEnforcement');
const concurrentRace = require('./scenarios/concurrentRace');
const customerIsolation = require('./scenarios/customerIsolation');
const equalTierFairness = require('./scenarios/equalTierFairness');
const northwindOverride = require('./scenarios/northwindOverride');
const identityHandling = require('./scenarios/identityHandling');
const redisFailure = require('./scenarios/redisFailure');
const retryAfterAccuracy = require('./scenarios/retryAfterAccuracy');
const { printReport, writeJsonReport } = require('./lib/report');

const scenarios = [
  ['Basic boundary', basicBoundary],
  ['Rolling expiration', rollingExpiration],
  ['Three-node enforcement', threeNodeEnforcement],
  ['Concurrent boundary race', concurrentRace],
  ['Customer isolation', customerIsolation],
  ['Equal-tier fairness', equalTierFairness],
  ['Northwind override', northwindOverride],
  ['Identity handling', identityHandling],
  ['Redis failure', redisFailure],
  ['Retry-After accuracy', retryAfterAccuracy],
];

async function main() {
  const results = [];
  for (const [label, fn] of scenarios) {
    console.log(`Running: ${label}...`);
    results.push(await fn());
  }
  const failures = printReport(results);
  const jsonPath = writeJsonReport(results);
  console.log(`\nResults written to ${jsonPath}`);
  process.exit(failures > 0 ? 1 : 0);
}

main();
