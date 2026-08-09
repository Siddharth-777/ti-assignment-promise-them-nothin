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

### Stop the service

```bash
docker compose down
```
