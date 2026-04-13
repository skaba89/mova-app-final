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

# ─── Stage 2: Production ──────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

# Install dumb-init for signal handling
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init wget && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r mova && useradd -r -g mova -d /app mova

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema & DB for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma-schema ./prisma-schema
COPY --from=builder /app/db ./db

# Copy entrypoint
COPY --chown=mova:mova entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

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
CMD ["/app/entrypoint.sh"]
