# ------------------------------------------------------------------------------
# AVORA BANK FRONTEND WEB - Next.js Standalone Production Dockerfile
# ------------------------------------------------------------------------------

# 1. Base image with Alpine Node 20 & dumb-init
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# 2. Dependencies installation
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 3. Next.js Standalone Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# 4. Hardened, Non-root Production Runner (~150MB image)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Run as unprivileged node user
USER node

# Copy standalone output and static assets
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]

