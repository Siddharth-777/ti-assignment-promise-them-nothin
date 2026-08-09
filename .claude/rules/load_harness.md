# Load Harness Rules

## Architecture

- All harness code lives under `harness/`. No harness file may exist outside this directory.
- The harness is a separate Node.js script/module. It calls the running service over HTTP.
- Never import, require, or directly invoke service code (`src/`). All interaction is via HTTP requests to the service's listening ports.
- The service must already be running (all three nodes + Redis) before harness execution begins.

## Scenario Structure

- Each scenario lives as its own function or file under `harness/scenarios/`, one scenario per concern.
- Every scenario is independently runnable. No scenario depends on side effects from another.
- Each scenario cleans up its own Redis state (flush relevant keys) before running to ensure isolation.

## Assertions

- Every scenario must assert an expected outcome against the actual outcome.
- Every scenario reports an explicit pass/fail verdict. No scenario may just print raw output without a verdict.
- A scenario passes only if all its assertions hold. Any assertion failure → scenario fails.

## Node Routing

- Three node ports are configured (e.g., 3001, 3002, 3003).
- Default routing: randomized per request across all three ports. Not sequential, not round-robin.
- Deterministic routing (single-node) only when a scenario specifically requires it (e.g., single-node sanity check).
- Cross-node scenarios must prove that requests hit different nodes and still share one quota.

## Required Scenarios

1. **Basic boundary** — 99th request allowed, 100th allowed, 101st → 429, for a 100 RPM test customer.
2. **Rolling expiration** — window fills to 429, then allows again once the oldest timestamp ages out of the 60s window.
3. **Three-node enforcement** — one customer's traffic spread across all three nodes still caps at exactly their quota.
4. **Concurrent boundary race** — simultaneous requests at the last available slot; only one is ever allowed.
5. **Customer isolation** — one customer's traffic never reduces another customer's budget.
6. **Equal-tier fairness** — two same-tier customers get identical enforcement under identical load patterns.
7. **Boundary-clustered traffic** — bursts around a fixed-window edge still count exactly (no fixed-window reset leakage).
8. **Northwind override** — applies only inside its configured window, base limit applies outside it, exceeding the override limit still rejects.
9. **Identity handling** — missing `X-Customer-Id` → 401, unknown customer → 403, neither creates limiter state in Redis.
10. **Retry-After accuracy** — rejected requests return `Retry-After` > 0, matching the oldest-timestamp calculation, not a hardcoded number.
11. **Redis failure** — simulated Redis outage → requests rejected (fail closed), never falls back to local counters.
12. **Auditability** — a logged/returned decision includes: `customer_id`, `timestamp`, `effective_limit`, `window_count`, `decision`, `reason`, `config_version`, `node_id`.
13. **Idempotent retry** — same idempotency key sent twice is not double-counted against quota.
14. **Combined worst-case load** — random routing + mixed normal/Northwind traffic + boundary bursts run together, every customer stays within their own limit.
15. **Config consistency** — all three nodes report the same `config_version` at the same point in time.
16. **Rate-limit headers** — `X-RateLimit-Limit` and `X-RateLimit-Remaining` on each response match actual internal state.

## Reporting

- Harness output must be a legible summary: console table or JSON report.
- Per scenario: name, expected outcome, actual outcome, pass/fail.
- A reviewer must be able to determine correctness from this output alone, without reading the harness or service source code.
- Final line: total passed / total run.
