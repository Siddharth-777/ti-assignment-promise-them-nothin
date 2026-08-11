#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# MSYS_NO_PATHCONV prevents Git Bash on Windows from mangling /CN=localhost
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout server.key -out server.crt \
  -days 3650 -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
echo "Generated certs/server.key and certs/server.crt (valid 10 years, localhost only)"
