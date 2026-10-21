# ------------------------------------------------------------------------------
# AVORA BANK API ENGINE - Enterprise Multi-Stage Dockerfile
# ------------------------------------------------------------------------------

# 1. Base Alpine Node 20 image with dumb-init
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# 2. Dependencies & Prisma generation stage
FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm install
RUN npx prisma generate

# 3. TypeScript compilation stage
FROM dependencies AS builder
WORKDIR /app
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build
RUN npm prune --omit=dev

# 4. Hardened, Non-root Production Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Prepare persistence directories
RUN mkdir -p /app/uploads && chown -R node:node /app

# Copy pruned dependencies, Prisma engine, and compiled dist
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/prisma ./prisma

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]

