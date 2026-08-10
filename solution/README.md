# RelayAPI Rate Limiter

Per-customer rate limiter service with sliding window log algorithm, enforced across three stateless nodes via Redis.

## Quick Start

### Prerequisites

- Docker and Docker Compose installed

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
curl http://localhost:3001/api/v1/ping
curl http://localhost:3002/api/v1/ping
curl http://localhost:3003/api/v1/ping
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

To run a single scenario:

```bash
node -e "require('./harness/scenarios/basicBoundary')().then(r => console.log(JSON.stringify(r, null, 2)))"
```

#### Note on `redisFailure` timing

The `redisFailure` scenario stops and restarts a real Docker container (`docker compose stop redis` / `docker compose start redis`) to verify fail-closed behavior. This can take 60+ seconds depending on Docker Desktop's state, especially during the first container lifecycle operation in a session. When running scenarios individually rather than through `run.js`, allow at least 120 seconds for `redisFailure` to complete.

### Stop the service

```bash
docker compose down
```
