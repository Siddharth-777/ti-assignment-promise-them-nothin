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

async function main() {
  const results = [];
  results.push(await basicBoundary());
  results.push(await rollingExpiration());
  results.push(await threeNodeEnforcement());
  results.push(await concurrentRace());
  results.push(await customerIsolation());
  results.push(await equalTierFairness());
  results.push(await northwindOverride());
  results.push(await identityHandling());
  results.push(await redisFailure());
  results.push(await retryAfterAccuracy());
  const failures = printReport(results);
  const jsonPath = writeJsonReport(results);
  console.log(`\nResults written to ${jsonPath}`);
  process.exit(failures > 0 ? 1 : 0);
}

main();
