#!/bin/sh
set -euo pipefail

# Ensure certs exist (self-signed if not provided)
CERT_DIR="/etc/nginx/certs"
CRT="$CERT_DIR/server.crt"
KEY="$CERT_DIR/server.key"

mkdir -p "$CERT_DIR"
if [ ! -f "$CRT" ] || [ ! -f "$KEY" ]; then
  echo "[entrypoint] generating self-signed TLS certs..."
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$KEY" -out "$CRT" -days 365 \
    -subj "/CN=localhost" >/dev/null 2>&1
fi

# Start signal server
export PORT=${PORT:-8787}
echo "[entrypoint] starting signal server on :$PORT"
node /opt/signal/dist/index.js &

# Start nginx in foreground
echo "[entrypoint] starting nginx on :80 and :443"
exec nginx -g 'daemon off;'

