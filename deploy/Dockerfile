# Multi-stage build: build frontend and signal server, then run with nginx + node

# -------- Frontend build --------
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy only needed packages for better caching
COPY shared/protocol ./shared/protocol
COPY client/package.json ./client/package.json
COPY client/vite.config.ts ./client/vite.config.ts
COPY client/postcss.config.cjs ./client/postcss.config.cjs
COPY client/tailwind.config.ts ./client/tailwind.config.ts
COPY client/index.html ./client/index.html
COPY client/public ./client/public
COPY client/src ./client/src
# No protocol build needed; client consumes shared/protocol source
RUN cd client && npm install --no-audit --no-fund

# Build-time configurable signal server public URL (optional)
# Example override: --build-arg VITE_SIGNAL_SERVER_URL=https://your-domain
ARG VITE_SIGNAL_SERVER_URL

RUN if [ -n "$VITE_SIGNAL_SERVER_URL" ]; then \
      echo "[build] using VITE_SIGNAL_SERVER_URL=$VITE_SIGNAL_SERVER_URL"; \
      VITE_SIGNAL_SERVER_URL="$VITE_SIGNAL_SERVER_URL" npm --prefix client run build; \
    else \
      echo "[build] using same-origin signal server"; \
      npm --prefix client run build; \
    fi

# Build logs (server) alongside frontend using root toolchain
# (frontend-only build here)

# -------- Signal server build --------
FROM node:20-alpine AS signal-builder
WORKDIR /signal

COPY signal/package.json signal/package-lock.json ./
RUN npm ci

COPY signal/ ./
# Keep shared protocol inside the signal workspace so TS can resolve external deps
COPY shared/protocol ./shared/protocol
RUN npm run build

# Install only production deps for runtime
RUN rm -rf node_modules && npm ci --omit=dev

# -------- Logs server build --------
FROM node:20-alpine AS logs-builder
WORKDIR /logs

COPY server/package.json ./server/package.json
COPY server/tsconfig.server.json ./server/tsconfig.server.json
COPY server/src ./server/src
RUN cd server && npm install --no-audit --no-fund && npm run build

# -------- Runtime image --------
FROM node:20-alpine AS runtime

RUN apk add --no-cache nginx openssl dumb-init

# Create required dirs
RUN mkdir -p /var/log/nginx /var/cache/nginx /etc/nginx/certs /usr/share/nginx/html

# Copy built frontend
COPY --from=frontend-builder /app/client/dist /usr/share/nginx/html

# Copy signal server build and runtime deps
WORKDIR /opt/signal
COPY --from=signal-builder /signal/dist ./dist
COPY --from=signal-builder /signal/package.json ./package.json
COPY --from=signal-builder /signal/package-lock.json ./package-lock.json
COPY --from=signal-builder /signal/node_modules ./node_modules

# Copy logs server build
WORKDIR /opt/logs
COPY --from=logs-builder /logs/server/dist ./dist

# Nginx config and entrypoint
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Internal signal server port (do not expose directly)
ENV SIGNAL_PORT=8787
ENV SERVER_PORT=8080

EXPOSE 80 443

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/entrypoint.sh"]
