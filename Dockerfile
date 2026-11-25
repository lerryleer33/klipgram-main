# KlipGram — Dokploy-ready image.
# Multi-stage build; the runtime includes yt-dlp (with Python) because the
# reel extraction falls back to it when Instagram blocks plain server requests.

# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
# npm ci is avoided because package.json pins a moving nightly
# (@typescript/native), which drifts out of sync with package-lock.json.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runner
WORKDIR /app

# Python 3 + pip for yt-dlp; curl for container health checks.
RUN apk add --no-cache python3 py3-pip curl ffmpeg \
    && pip3 install --no-cache-dir --break-system-packages yt-dlp \
    && addgroup -S nodejs -g 1001 \
    && adduser -S nextjs -u 1001

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone output from next.config.ts (output: 'standalone').
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
