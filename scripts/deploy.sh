#!/usr/bin/env bash
# ==============================================================================
# AVORA BANK - Automated Zero-Downtime Production Deployment Script
# ==============================================================================
set -e

echo "🚀 [$(date '+%Y-%m-%d %H:%M:%S')] Starting Avora Bank Production Deployment..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Check for .env file
if [ ! -f ".env" ]; then
    echo "❌ Error: Production .env file not found in root directory!"
    exit 1
fi

# 2. Pull latest code from main branch
echo "📥 Fetching latest commits from git origin/main..."
git fetch origin main
CURRENT_COMMIT=$(git rev-parse HEAD)
TARGET_COMMIT=$(git rev-parse origin/main)

if [ "$CURRENT_COMMIT" = "$TARGET_COMMIT" ]; then
    echo "ℹ️ System is already up-to-date with origin/main ($CURRENT_COMMIT)."
else
    echo "🔄 Pulling updates ($CURRENT_COMMIT -> $TARGET_COMMIT)..."
    git pull origin main
fi

# 3. Backend Dependency Check & Prisma Migration
echo "📦 Installing server dependencies & compiling Prisma Client..."
cd "$ROOT_DIR/apps/server"
npm ci --silent
npx prisma generate
echo "🗄️ Verifying Database Schema Synchronization..."
npx prisma db push --skip-generate

echo "🔨 Building TypeScript API server..."
npm run build

# 4. Frontend Dependency Check & Next.js Production Build
echo "🌐 Installing frontend dependencies & building Next.js Standalone..."
cd "$ROOT_DIR/apps/web"
npm ci --silent
npm run build

# 5. Reload Application Processes
cd "$ROOT_DIR"
if command -v pm2 &> /dev/null; then
    echo "⚡ Reloading PM2 Cluster processes..."
    pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
    pm2 save
elif command -v docker &> /dev/null && [ -f "docker-compose.yml" ]; then
    echo "🐳 Rebuilding and restarting Docker containers..."
    docker compose up -d --build --remove-orphans
else
    echo "⚠️ Neither PM2 nor Docker found. Please restart processes manually."
fi

# 6. Post-Deployment Health Verification
echo "🩺 Performing automated healthcheck verification..."
sleep 5
HEALTH_URL="http://localhost:5000/api/v1/health"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Healthcheck passed (HTTP $HTTP_STATUS) at $HEALTH_URL!"
    echo "🎉 [$(date '+%Y-%m-%d %H:%M:%S')] Avora Bank successfully deployed!"
else
    echo "⚠️ Warning: Healthcheck returned HTTP $HTTP_STATUS. Please inspect application logs."
    exit 1
fi

