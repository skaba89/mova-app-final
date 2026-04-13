#!/bin/bash
set -e

echo "=== MOVA App Starting ==="
echo "DATABASE_URL=$DATABASE_URL"

# Run Prisma db push to ensure schema is in sync
if [ -f "/app/prisma/schema.prisma" ]; then
  echo "Running Prisma db push..."
  npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || echo "Prisma push skipped (DB may already be in sync)"
elif [ -f "/app/prisma-schema/schema.prisma" ]; then
  echo "Running Prisma db push (prisma-schema)..."
  npx prisma db push --schema=/app/prisma-schema/schema.prisma --skip-generate --accept-data-loss 2>/dev/null || echo "Prisma push skipped"
fi

# Ensure database directory exists
mkdir -p /app/db

# Start the Next.js server
echo "Starting Next.js on port ${PORT:-3000}..."
exec node /app/server.js
