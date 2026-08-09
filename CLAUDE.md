# CLAUDE.md

## What This Is

RelayAPI is a fictional B2B API platform selling metered HTTP access. Three stateless app nodes sit behind a round-robin load balancer; customers are identified by an `X-Customer-Id` header. We are building a per-customer rate limiter that enforces contracted RPM quotas across all three nodes using Redis as the single source of truth. The core conflict: the CTO demands hard, auditable, strictly-fair enforcement where no customer ever exceeds quota ("never" — not mostly, not on average), while the support lead demands that Northwind Logistics (60% of revenue, renewal in six weeks) must never see a 429 during their 02:00–04:00 UTC batch window, even though that batch sustains 800–1200 RPM against a 300 RPM contract. These two directives are mutually exclusive under a literal reading; the resolution is a config-driven timed override that raises Northwind's effective limit during the batch window — satisfying the CTO's "no hard-coded customer checks" rule while giving support their operational guarantee.

## Design Decisions (Final)

Do not relitigate these without asking first.

- **Algorithm:** Exact sliding window log. Not fixed window. Not the sliding window counter approximation.
- **Coordination:** Redis is the single shared state. One atomic Lua script per request performs the full check-and-record decision.
- **Clock:** All timestamp and window logic uses Redis server time (`redis.call('TIME')`). Never use a node's local system clock.
- **Northwind conflict resolution:** A timed-window override. Base limit 300 RPM; a separate higher limit is active only during their 02:00–04:00 UTC batch window. Driven entirely by config. Never a hard-coded customer ID check in application logic.
- **Identity:** `X-Customer-Id` header is trusted as-is. No authentication logic. Missing header → 401. Present header but unknown customer → 403. Neither case creates Redis state.
- **Redis failure:** If Redis is unreachable, reject the request (fail closed). Never fall back to local per-node counters.
- **Config:** Loaded once per node at startup from a config file. No dynamic reload, no hot-swap.

## Prototype Must-Haves

- Per-customer rate limiting with one shared quota across all 3 nodes
- Hard enforcement with 429 Too Many Requests and Retry-After header
- Exact auditable trailing-window semantics (sliding window log)
- Explicit handling of the Northwind business exception via config
- A load harness that demonstrates correctness and exposes distributed races

## Requirements

1. **Hard enforcement:** Stop accepting requests above the limit. Return 429 with `Retry-After`.
2. **Per-customer isolation:** One customer's traffic must not affect another.
3. **Strictly fair metering:** Same tier = same treatment. Config-driven rules, not hard-coded exceptions.
4. **Auditable:** Deterministic counting rule; can explain/reconstruct any customer's request count.
5. **Stateless app nodes:** No rate-limit state in node memory. All state in Redis.
6. **Error direction:** Over-limiting is allowed. Under-limiting is not. False rejection is preferable to quota leakage.
7. **Well-understood algorithm:** Sliding window log + Redis + Lua script for atomic operations.

## Working Style

- **One concern per prompt.** If a request spans multiple concerns, implement the first and stop. Ask whether to continue.
- **No unrequested functionality.** Even obvious next steps get flagged, not implemented.
- **No out-of-scope refactoring.** Note it instead of changing it.
- **End-of-response summary:** What files were touched, what the new behavior is, what was not done that might be expected.
- **Options, not silence:** When multiple valid approaches exist for an undecided point, present options briefly with a recommendation. Do not pick silently or ask open-ended questions without framing.
