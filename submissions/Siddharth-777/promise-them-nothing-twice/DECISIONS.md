# Decisions — Promise Them Nothing Twice

## Conflict resolution
The CTO team demands hard auditable strictly fair enforcement where no customer ever exceeds their respective quota. The support team demands Northwind never sees a 429 during their 2:00 to 4:00 UTC batch window, despite sustaining 800-1200 RPM against the 300 RPM contract.  
 
We can not enforce 300 RPM strictly because it guarantees Northwind sees 429 every night. We can not reject Northwind during the night batch because it does not enforce their contracted rate. This conflict may seem mutually exclusive under literal reading but can be resolved with some config change rather than a code bypass.

**Resolution:** My solution uses a time-windowed config override that raises Northwind's effective limit to 1500 RPM only during 2-4 UTC, driven entirely by a config file rather than a hardcoded customer-ID check. The LUA script evaluates the override activation using Redis server time so all nodes agree without any contradiction concurrently. 

**Rejected:** This solution intentionally rejects a flat 24/7 elevated limit, which violates the tier equality. There is no hardcoded customer-ID bypass in the middleware. We do not provide unlimited traffic during the window and enforce a higher limit for the nightly batch.

**Residual gap:** If Northwind's real traffic exceeds 1500 rpm during the window, they will still receive 429. A queuing approach could guarantee zero rejections but was deferred because the prototype proves the mechanism, not the capacity planning math. 



## Technical design

**Algorithm:** Exact sliding window log backed by a per-customer Redis stored set. On each request, trim entries older than the now-window. Count what remains and conditionally add the new entry, all inside a single lua script. The Trim+Count+Add sequence is an atomic operation across concurrent requests from any three nodes. 

**Coordination:** Redis, single atomic Lua script per request. Full decision in one EVAL: obtain Redis TIME, determine effective limit (override windows evaluated inside Lua via seconds-since-midnight), prune expired timestamps, count, record if allowed, compute Retry-After if rejected. No separate Redis calls from Node.js — atomicity prevents cross-node races.

**Clock:** `redis.call('TIME')` exclusively. Node-local clocks never touch rate-limit windows.

**Isolation:** One sorted-set key per customer (`ratelimit:{customer_id}`). No shared pools.

**Failure:** Fail closed on Redis error — 429, never local counters.

**Identity:** `X-Customer-Id` trusted as-is; missing → 401, unknown → 403, neither creates Redis state.

**Rejected Algorithms:** Fixed window was rejected due to the boundary flaw, which allows 2x quota across the window edge. Sliding window counter was rejected due to the estimation error, which can overcount, violating the CTO's requirement. Token bucket was rejected because it was built for brief bursts not Northwind's sustained 90 to 120 nightly overage. Leaky bucket was rejected because it needs queuing infra and an unverified latency tolerance assumption. 

## Verification

**Built:** A harness engine that is capable of running 10 individual unique tests: basicBoundary, rollingExpiration, threeNodeEnforcement, concurrentRace, customerIsolation, equalTierFairness, northwindOverride, identityHandling, redisFailure, retryAfterAccuracy. These tests cover every property that directly proves the config test solution and also co-distributed correctness (cross-node quota, atomicity under concurrency, isolation, fairness, boundary behavior, computed Retry-After).

**Note:** A generic load testing tool like k6 or autocannon could supplement this harness for raw throughput/stress testing but it was not the primary tool here because the priority was scenario-specific correctness proofs rather than raw requests per second benchmarking. 

**Bugs found and fixed:**
- Microsecond timestamp collision: two same-microsecond requests collapsed into one ZADD entry (no-op on duplicate member), silently under-counting — fixed with an atomic `INCR` sequence suffix on the member while preserving the score for window math.
- Unhandled Redis `'error'` event: crashed the entire Node process instead of failing one request — fixed with a no-op error listener; individual calls still reject into the middleware's fail-closed try/catch.
- Docker config baking: `COPY . .` in Dockerfile meant `docker compose restart` served stale config — documented that `--build` is required after config changes.
- Northwind test timing circularity: hardcoded override windows expired between test runs — fixed by computing fresh windows dynamically on every execution.
- An early non-reproducing timing anomaly in the rolling window test was investigated across various sessions. The two most plausible causes were cross-scenario Redis contamination and margin insufficiency. These two were both ruled out with direct evidence through code review, confirming full state isolation between scenarios and six consecutive clean passes after the margin fix. 

## If I had four more hours

The current ten test cases prove every core correctness property that the required system needs: conflict resolution, distributed enforcement, atomicity, isolation, fairness, and fail-closed behavior.

With more time I would have added additional verification that are polished layers on top of the foundation that we already own 

**Combined worst-case scenario:** A combined worst-case scenario stacking random routing, mixed Northwind and normal traffic, and boundary bursts simultaneously.

**Structured auditability logging:** A structured auditability logging per the compliance requirement so the decision is reconstructable from a single log line rather than inferred from Redis state. 

**Idempotency key support:** Idempotency key support so Northwind's re-entry amplification risk is neutralized at the request level and not just handled by fail close behavior. 

**Load-testing tooling:** An additional generic load tool like k6 or autocannon, alongside our custom harness for raw throughput benchmarking, to complement the scenario-based correctness proofs already in place 
