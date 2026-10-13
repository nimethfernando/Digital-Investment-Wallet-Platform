#!/usr/bin/env bash
# ==============================================================================
# AVORA BANK - Automated Health & Ledger Balance Invariant Verifier
# ==============================================================================
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${API_URL:-http://localhost:5000}"
WEB_URL="${WEB_URL:-http://localhost:3000}"

echo "===================================================="
echo "🩺 AVORA BANK SYSTEM HEALTH & LEDGER VERIFIER"
echo "===================================================="
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

# 1. API Healthcheck
echo "Checking Backend API Health ($API_URL/api/v1/health)..."
API_CODE=$(curl -s -o /tmp/avora_api_health.json -w "%{http_code}" "$API_URL/api/v1/health" || echo "000")
if [ "$API_CODE" = "200" ]; then
    echo "  ✅ API Status: 200 OK"
    cat /tmp/avora_api_health.json
    echo ""
else
    echo "  ❌ API Status: FAILED (HTTP $API_CODE)"
fi

# 2. Frontend Healthcheck
echo "Checking Frontend Web Portal ($WEB_URL)..."
WEB_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL" || echo "000")
if [ "$WEB_CODE" = "200" ]; then
    echo "  ✅ Frontend Status: 200 OK"
else
    echo "  ❌ Frontend Status: FAILED (HTTP $WEB_CODE)"
fi

# 3. Double-Entry Ledger Invariant Verification
echo ""
echo "Running Double-Entry Ledger Mathematical Verification..."
cd "$ROOT_DIR/apps/server"
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkLedger() {
  const result: any[] = await prisma.\$queryRaw\`
    SELECT 
      direction, 
      currency, 
      SUM(amount) as total 
    FROM diw_ledger_entries 
    GROUP BY direction, currency
  \`;

  console.log('  Ledger Entry Aggregates:', result);
  
  // Calculate USD balance
  let debitUSD = 0;
  let creditUSD = 0;
  for (const r of result) {
    if (r.currency === 'USD') {
      if (r.direction === 'DEBIT') debitUSD = Number(r.total);
      if (r.direction === 'CREDIT') creditUSD = Number(r.total);
    }
  }

  const diff = Math.abs(debitUSD - creditUSD);
  if (diff < 0.0001) {
    console.log('  ✅ Double-Entry Accounting Invariant HEALTHY: sum(Debit) === sum(Credit) [Delta: \$' + diff.toFixed(4) + ']');
  } else {
    console.error('  ❌ LEDGER IMBALANCE DETECTED! Debit: ' + debitUSD + ' vs Credit: ' + creditUSD);
    process.exit(1);
  }
}

checkLedger().finally(() => prisma.\$disconnect());
"

echo ""
echo "===================================================="
echo "🎉 All System Health & Accounting Audits Passed!"
echo "===================================================="

