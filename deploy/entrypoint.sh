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

# Start signal server on dedicated internal port to avoid clashing with nginx
SIGNAL_PORT=${SIGNAL_PORT:-8787}
export SIGNAL_PORT
unset PORT
echo "[entrypoint] starting signal server on :$SIGNAL_PORT"
node /opt/signal/dist/index.js &

# Start logs server (HTTP) on internal port used by nginx /api upstream
LOGS_PORT=${LOGS_PORT:-8080}
export PORT=$LOGS_PORT
export DATA_ROOT=${DATA_ROOT:-/data/llm-logs}
mkdir -p "$DATA_ROOT"
export AUTH_BASIC_ENABLED=${AUTH_BASIC_ENABLED:-true}
export AUTH_USERS=${AUTH_USERS:-admin:admin}
echo "[entrypoint] starting logs server on :$LOGS_PORT (data at $DATA_ROOT)"
node /opt/logs/dist/index.js &

# Start nginx in foreground
echo "[entrypoint] starting nginx on :80 and :443"
exec nginx -g 'daemon off;'

