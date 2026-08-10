# RelayAPI Rate Limiter

Per-customer rate limiter service with sliding window log algorithm, enforced across three stateless nodes via Redis.

**Setup time: approximately 2 minutes** (docker compose build + start on a warm Docker cache; ~4 minutes on first pull of node:20-alpine and redis:7-alpine).

**Algorithm:** Exact sliding window log - each accepted request records a microsecond-precision timestamp in a per-customer Redis sorted set, and every new request prunes entries older than 60 seconds before counting. This gives deterministic, auditable enforcement with zero approximation error. See [DECISIONS.md](../DECISIONS.md) for the full reasoning and rejected alternatives.

## Test customers

| customer_id | base_limit | override |
|---|---|---|
| acme | 300 RPM | none |
| northwind | 300 RPM | 1500 RPM during 02:00–04:00 UTC |
| test-boundary | 10 RPM | none |
| test-isolation-b | 10 RPM | none |
| test-northwind-active | 10 RPM | 20 RPM during dynamic 30-min window |
| test-northwind-inactive | 10 RPM | 20 RPM during a window always in the future |

## Quick Start

### One-command verify (optional)

To build, start, health-check, and run the full test suite in one shot:

```bash
# Linux/macOS/Git Bash
./verify.sh

# Windows PowerShell
.\verify.ps1
```

The script exits 0 on all-pass, 1 on any failure (CI-friendly). The manual steps below still work independently if you prefer to run things piecemeal.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (free) with Docker Compose. There is no non-Docker path - config is baked into images at build time and the three-node deployment is Docker Compose-orchestrated by design.

### Run the service

```bash
cd solution
docker compose up --build
```

This starts:
- Redis on port 6379
- App node 1 on port 3001
- App node 2 on port 3002
- App node 3 on port 3003

### Verify all nodes are running

```bash
curl -H "X-Customer-Id: acme" http://localhost:3001/api/v1/ping
curl -H "X-Customer-Id: acme" http://localhost:3002/api/v1/ping
curl -H "X-Customer-Id: acme" http://localhost:3003/api/v1/ping
```

Each should return:

```json
{"status":"ok"}
```

### Updating customer config

`config/customers.json` is baked into the Docker image at build time, not mounted live. After editing it, you must rebuild:

```bash
docker compose up -d --build
```

A plain `docker compose restart` will keep serving the old config.

### Run the load harness

With the service running, execute the full scenario suite:

```bash
node harness/run.js
```

Results are printed to the terminal as a table and also written as JSON to `harness/results.json` (overwritten on each run).

To run a single scenario:

```bash
node -e "require('./harness/scenarios/basicBoundary')().then(r => console.log(JSON.stringify(r, null, 2)))"
```

#### Note on `redisFailure` timing

The `redisFailure` scenario stops and restarts a real Docker container (`docker compose stop redis` / `docker compose start redis`) to verify fail-closed behavior. This can take 60+ seconds depending on Docker Desktop's state, especially during the first container lifecycle operation in a session. When running scenarios individually rather than through `run.js`, allow at least 120 seconds for `redisFailure` to complete.

#### Sample output

```
NAME                                RESULT  DETAIL
----------------------------------  ------  ------
basicBoundary                       PASS
Rolling expiration (10 RPM)         PASS
Three-node enforcement (10 RPM)     PASS    port distribution: {"3001":6,"3002":3,"3003":1}
Concurrent boundary race (10 RPM)   PASS    portA=3003 status=200, portB=3002 status=429
Customer isolation (10 RPM each)    PASS
Equal-tier fairness (10 RPM each)   PASS
Northwind override (time-windowed)  PASS
Identity handling (401/403)         PASS
Redis failure (fail-closed)         PASS
Retry-After accuracy                PASS    actual=55s expected=55s diff=0s tolerance=±2s elapsed=5030ms

10/10 passed
```

Key evidence of correctness:
- **Three-node port distribution** (`3001:6, 3002:3, 3003:1`): requests hit all three nodes randomly, yet the shared quota still caps at exactly 10.
- **Concurrent race** (`portA=3003 status=200, portB=3002 status=429`): two simultaneous requests at the last slot - Lua atomicity ensures exactly one wins.
- **Retry-After accuracy** (`actual=55s expected=55s diff=0s`): the header is computed from the oldest timestamp in the window, not hardcoded. A 5-second delay before the rejected request shifts the expected value from 60 to ~55, proving dynamic computation.

### Stop the service

```bash
docker compose down
```

## Counting semantics

Every request is counted in an exact trailing 60-second window maintained per customer in Redis. The check-and-record operation executes atomically inside a single Lua script (EVAL): obtain Redis server time, prune timestamps older than T−60s, count remaining entries, and - only if count < limit - record the new timestamp. Because the entire decision is one atomic Redis operation, concurrent requests from any combination of the three nodes cannot race past the configured limit. There is no approximation, no sampling, and no scenario in which the true request count within any 60-second window can exceed the customer's configured limit.
