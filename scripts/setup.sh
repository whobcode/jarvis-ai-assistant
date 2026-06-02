#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx wrangler whoami >/dev/null 2>&1 || npx wrangler login
[ -f schema.sql ] && { echo "==> Applying schema.sql to D1"; npx wrangler d1 execute jarvis-conversations --file=./schema.sql --remote || true; }
echo "==> Set secrets (Ctrl-C to skip any)"
for s in ANTHROPIC_API_KEY OPENAI_API_KEY JWT_SECRET; do
  read -rp "Set $s now? [y/N] " a; [[ "$a" =~ ^[Yy]$ ]] && npx wrangler secret put "$s" || echo "  skipped $s"
done
echo "==> Done. Deploy with: npm run deploy"
