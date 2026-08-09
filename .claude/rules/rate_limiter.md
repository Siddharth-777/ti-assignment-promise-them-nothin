# Rate Limiter Rules

## Algorithm

- Sliding window log over a true trailing 60-second interval.
- For evaluation time T, the active window is [T − 60s, T].
- Only accepted requests add timestamps. Rejected requests do not consume quota.

## Decision Order

1. Obtain Redis server time.
2. Determine effective limit.
3. Remove expired timestamps (older than T − 60s).
4. Count active timestamps.
5. If count >= limit, reject.
6. Otherwise record current timestamp.
7. Return decision and Retry-After value.

## File Boundaries

- `src/redis-client.js` — sole module that imports `ioredis`. No other file may require/import ioredis.
- `src/limiter.lua` — the Lua script lives in its own file. Loaded once via `defineCommand`. Never inlined as a string in any .js file.
- `src/middleware/rateLimiter.js` — may only: read `X-Customer-Id` header, call `configResolver.resolveLimit()`, call `limiter.checkAndRecord()`, translate result to HTTP response. Zero Redis calls, zero Lua text, zero window/limit arithmetic.
- `src/configResolver.js` — sole file that reads `config/customers.json` or compares timestamps against override windows.

## Key and Naming

- Redis key format: `ratelimit:{customer_id}`. No other prefix, no environment suffix.
- All Redis timestamps come from `redis.call('TIME')` inside the Lua script. `Date.now()` and `new Date()` must never produce values compared against rate-limit windows.

## Atomicity

- Any operation that reads count and may write a new entry must execute inside `src/limiter.lua` as a single EVAL/defineCommand call.
- No sequence of separate `.get()` then `.set()`/`.zadd()` calls from Node.js for the check-and-record path.

## Lua Script Decision Order

TIME → determine effective limit → prune expired → count active → compare with limit → record if allowed → calculate Retry-After if rejected → return result.

## Northwind Override

- Override active/inactive decision (`override_start <= redis_now < override_end`) happens inside the Lua script using Redis TIME.
- Never evaluated in application code. Never as a customer-ID string comparison.
- Application passes override parameters to Redis; Redis decides activation.
- Config shape per customer override entry: `customer_id`, `base_limit`, `override_limit`, `override_start`, `override_end`, `owner`, `reason`, `review_date`, `config_version`.
- Northwind base limit: 300 RPM. During approved window: `effective_limit = override_limit`. Outside: `effective_limit = base_limit`.
- If Northwind exceeds override limit, 429 is correct.

## Response Contract

- Every 429 includes `Retry-After` header computed from the oldest active timestamp. Never a hardcoded constant.
- Missing `X-Customer-Id` → 401. No Redis key created. Lua script not called.
- Header present, customer unknown → 403. No Redis key created. Lua script not called.

## Counting Semantics

- Accepted request: consumes quota (timestamp recorded).
- Rejected 429: does not consume quota.
- 401 (missing header): does not consume quota.
- 403 (unknown customer): does not consume quota.
- Accepted then upstream 4xx/5xx: still consumed (counted at admission).

## Configuration

- `config/customers.json` read exactly once at startup, cached for process lifetime. No file-watching, no re-read.
- Every customer entry requires: `customer_id`, `base_limit`, `overrides` (array, possibly empty). No optional fields with implicit defaults.

## Customer Identity

- Identity from `X-Customer-Id` header, trusted as-is.
- Missing → 401 Unauthorized. No rate-limit state created.
- Present but unknown → 403 Forbidden. No rate-limit key created.

## Error Handling

- Every Redis call in request path wrapped in try/catch. On error: return 429 (fail closed). Never fall through to allow.
- No `console.log` in request-path code. Use `src/logger.js` if logging needed.

## Dependencies

- Approved: `express`, `ioredis`. Any other dependency requires explicit approval with one-sentence justification.
- Do not add: authentication, TLS, metrics/dashboards, dynamic config reload.
