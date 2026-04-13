# ─── Stage 1: Build ───────────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client with library engine (no native binary needed)
RUN bunx prisma generate --schema=prisma-schema/schema.prisma

# Create SQLite database with all tables during build
RUN mkdir -p /app/db && \
    DATABASE_URL="file:/app/db/custom.db" \
    bunx prisma db push --schema=prisma-schema/schema.prisma --skip-generate --accept-data-loss 2>&1 && \
    echo "=== DB tables created ===" && \
    sqlite3 /app/db/custom.db ".tables" || echo "SQLite not available, tables will be created at runtime"

# Build Next.js (standalone mode)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN bun run build

# ─── Stage 2: Production ──────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

# Install runtime dependencies: SQLite3, dumb-init
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init wget sqlite3 su-exec \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r mova && useradd -r -g mova -d /app mova

# Copy standalone build
COPY --from=builder /app/.next/standalone ./

# Copy static files (always fresh from build)
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema
COPY --from=builder /app/prisma-schema ./prisma-schema

# Copy Prisma client (runtime) - library engine, no binary needed
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy pre-built database as template
COPY --from=builder /app/db/custom.db /app/db-template/custom.db

# Create db directory and set permissions
RUN mkdir -p /app/db /app/db-template && \
    chown -R mova:mova /app/db /app/db-template /app/prisma-schema /app/node_modules

# Set environment
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=file:/app/db/custom.db
ENV JWT_SECRET=mova-super-secret-jwt-key-change-in-production-2024

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "chown -R mova:mova /app/db 2>/dev/null; mkdir -p /app/db && if [ ! -f /app/db/custom.db ]; then cp /app/db-template/custom.db /app/db/custom.db && chown mova:mova /app/db/custom.db; fi && exec su-exec mova node /app/server.js"]
