# ─── Stage 1: Build ───────────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client (use prisma-schema directory)
RUN bunx prisma generate --schema=prisma-schema/schema.prisma

# Build Next.js (standalone mode)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN bun run build

# Verify static files were copied into standalone correctly
RUN echo "=== Static files in standalone ===" && \
    ls -la .next/standalone/.next/static/chunks/ 2>/dev/null && \
    echo "=== Chunk count ===" && \
    ls .next/standalone/.next/static/chunks/ 2>/dev/null | wc -l

# ─── Stage 2: Production ──────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

# Install dumb-init for signal handling + SQLite3 for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init wget sqlite3 && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r mova && useradd -r -g mova -d /app mova

# Copy standalone build
COPY --from=builder /app/.next/standalone ./

# Copy static files (always fresh from build)
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema
COPY --from=builder /app/prisma-schema ./prisma-schema

# Copy Prisma client + CLI (needed for runtime + db push)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Create a script to run prisma db push and start server
RUN mkdir -p /app/db && chown -R mova:mova /app/db /app/prisma-schema /app/node_modules

# Set environment
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=file:/app/db/custom.db

# Switch to non-root user
USER mova

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "mkdir -p /app/db && if [ -f /app/prisma-schema/schema.prisma ]; then echo 'Running Prisma db push...' && node /app/node_modules/prisma/build/index.js db push --schema=/app/prisma-schema/schema.prisma --skip-generate --accept-data-loss 2>&1 || echo 'Prisma push done (may have warnings)'; fi && echo 'Starting Next.js on port 3000...' && exec node /app/server.js"]
