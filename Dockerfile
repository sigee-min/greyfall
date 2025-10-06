# Multi-stage build: build frontend and signal server, then run with nginx + node

# -------- Frontend build --------
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy root manifests first for better layer caching
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.node.json tsconfig.test.json ./
COPY vite.config.ts ./
COPY postcss.config.cjs ./
COPY tailwind.config.ts ./
COPY scripts ./scripts
COPY public ./public
COPY src ./src
COPY index.html ./

RUN npm ci

# Build-time configurable signal server public URL (optional)
# Example override: --build-arg VITE_SIGNAL_SERVER_URL=https://your-domain
ARG VITE_SIGNAL_SERVER_URL

# If provided, expose it only for the build step; otherwise build with same-origin defaults
RUN if [ -n "$VITE_SIGNAL_SERVER_URL" ]; then \
      echo "[build] using VITE_SIGNAL_SERVER_URL=$VITE_SIGNAL_SERVER_URL"; \
      VITE_SIGNAL_SERVER_URL="$VITE_SIGNAL_SERVER_URL" npm run build; \
    else \
      echo "[build] using same-origin signal server"; \
      npm run build; \
    fi

# -------- Signal server build --------
FROM node:20-alpine AS signal-builder
WORKDIR /signal

COPY signal/package.json signal/package-lock.json ./
RUN npm ci

COPY signal/ ./
RUN npm run build

# Install only production deps for runtime
RUN rm -rf node_modules && npm ci --omit=dev

# -------- Runtime image --------
FROM node:20-alpine AS runtime

RUN apk add --no-cache nginx openssl dumb-init

# Create required dirs
RUN mkdir -p /var/log/nginx /var/cache/nginx /etc/nginx/certs /usr/share/nginx/html

# Copy built frontend
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy signal server build and runtime deps
WORKDIR /opt/signal
COPY --from=signal-builder /signal/dist ./dist
COPY --from=signal-builder /signal/package.json ./package.json
COPY --from=signal-builder /signal/package-lock.json ./package-lock.json
COPY --from=signal-builder /signal/node_modules ./node_modules

# Nginx config and entrypoint
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Internal signal server port (do not expose directly)
ENV PORT=8787

EXPOSE 80 443

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/entrypoint.sh"]
