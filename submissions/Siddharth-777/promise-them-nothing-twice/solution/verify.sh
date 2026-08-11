#!/usr/bin/env bash
set -euo pipefail

PORTS=(3001 3002 3003)
TIMEOUT=60
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== RelayAPI Rate Limiter - Verify ==="
echo ""

# 1. Check Docker
echo "[1/5] Checking Docker..."
if ! command -v docker &>/dev/null; then
  echo "ERROR: docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop/"
  exit 1
fi
if ! docker info &>/dev/null; then
  echo "ERROR: Docker daemon is not running. Start Docker Desktop and try again."
  exit 1
fi
echo "       Docker is installed and running."
echo ""

# 2. Generate TLS certificate if absent
echo "[2/5] Ensuring TLS certificate exists..."
if [ ! -f certs/server.crt ] || [ ! -f certs/server.key ]; then
  bash certs/generate.sh
fi
echo "       Certificate ready."
echo ""

# 3. Build and start
echo "[3/5] Running docker compose up --build -d..."
docker compose up --build -d
echo "       Containers started."
echo ""

# 4. Poll health checks
echo "[4/5] Waiting for nodes to respond (timeout: ${TIMEOUT}s)..."
elapsed=0
all_ready=false
while [ $elapsed -lt $TIMEOUT ]; do
  ready=0
  for port in "${PORTS[@]}"; do
    if curl -ksf -H "X-Customer-Id: acme" "https://localhost:${port}/api/v1/ping" &>/dev/null; then
      ready=$((ready + 1))
    fi
  done
  if [ $ready -eq ${#PORTS[@]} ]; then
    all_ready=true
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

if [ "$all_ready" = false ]; then
  echo "ERROR: Timed out after ${TIMEOUT}s. Status:"
  for port in "${PORTS[@]}"; do
    if curl -ksf -H "X-Customer-Id: acme" "https://localhost:${port}/api/v1/ping" &>/dev/null; then
      echo "       port ${port}: OK"
    else
      echo "       port ${port}: NOT RESPONDING"
    fi
  done
  exit 1
fi
echo "       All nodes responding (${elapsed}s elapsed)."
echo ""

# 5. Run harness
echo "[5/5] Running load harness..."
echo ""
node harness/run.js
harness_exit=$?
echo ""

# 5. Summary
if [ $harness_exit -eq 0 ]; then
  echo "=== RESULT: ALL SCENARIOS PASSED ==="
else
  echo "=== RESULT: ONE OR MORE SCENARIOS FAILED ==="
fi
echo ""
echo "Run 'docker compose down' to stop the stack when done."

# 6. Exit with harness code
exit $harness_exit
