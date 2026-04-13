#!/bin/bash
set -e

echo "=== MOVA App Starting ==="
echo "DATABASE_URL=$DATABASE_URL"

# Run Prisma migrations (push schema to DB)
if [ -f "/app/prisma/schema.prisma" ]; then
  echo "Running Prisma db push..."
  npx prisma db push --skip-generate 2>/dev/null || echo "Prisma push skipped (DB may already be in sync)"
fi

# Start the Next.js server
echo "Starting Next.js on port ${PORT:-3000}..."
exec node server.js
