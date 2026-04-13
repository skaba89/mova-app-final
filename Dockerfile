# ─── Stage 1: Build ───────────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

RUN bunx prisma generate --schema=prisma-schema/schema.prisma

RUN mkdir -p /app/db && \
    DATABASE_URL="file:/app/db/custom.db" \
    bunx prisma db push --schema=prisma-schema/schema.prisma --skip-generate --accept-data-loss 2>&1 && \
    echo "=== DB tables created ==="

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN bun run build

# ─── Stage 2: Production ──────────────────────────────────────────────────
# node:20 = Debian Bookworm + OpenSSL 3.0.x (meme version que le builder oven/bun:1)
FROM node:20 AS production

WORKDIR /app

RUN groupadd -r mova && useradd -r -g mova -d /app mova

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma-schema ./prisma-schema
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/db/custom.db /app/db-template/custom.db

RUN mkdir -p /app/db /app/db-template && \
    chown -R mova:mova /app/db /app/db-template /app/prisma-schema /app/node_modules

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=file:/app/db/custom.db
ENV JWT_SECRET=mova-super-secret-jwt-key-change-in-production-2024

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:3000/ || exit 1

CMD ["sh", "-c", "chown -R mova:mova /app/db 2>/dev/null; mkdir -p /app/db && if [ ! -f /app/db/custom.db ]; then cp /app/db-template/custom.db /app/db/custom.db && chown mova:mova /app/db/custom.db; fi && su - mova -c 'node /app/server.js'"]
