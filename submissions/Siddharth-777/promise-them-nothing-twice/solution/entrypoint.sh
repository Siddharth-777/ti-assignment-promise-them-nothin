#!/bin/sh
set -e

CERT_DIR="/app/certs"
KEY="$CERT_DIR/server.key"
CRT="$CERT_DIR/server.crt"

if [ ! -f "$KEY" ] || [ ! -f "$CRT" ]; then
  mkdir -p "$CERT_DIR"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$KEY" -out "$CRT" \
    -days 3650 -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
    2>/dev/null
  echo "Generated TLS cert at $CRT"
fi

exec node src/server.js
