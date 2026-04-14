# ─── Stage 1: Build ───────────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

RUN bunx prisma generate --schema=prisma-schema/schema.prisma

RUN mkdir -p /app/db && \
    DATABASE_URL="file:/app/db/custom.db" \
    bunx prisma db push --schema=prisma-schema/schema.prisma --skip-generate 2>&1 && \
    echo "=== DB tables created ==="

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN bun run build

# ─── Stage 2: Production ──────────────────────────────────────────────────
# node:20 = Debian Bookworm + OpenSSL 3.0.x (same as oven/bun:1 builder)
FROM node:20 AS production

WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma-schema ./prisma-schema
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/db/custom.db /app/db-template/custom.db

RUN mkdir -p /app/db /app/db-template

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=file:/app/db/custom.db
# JWT_SECRET doit etre injecte via docker-compose, docker run -e, ou un secret Docker
# ENV JWT_SECRET=change-me-in-production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/mova/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD sh -c "mkdir -p /app/db && if [ ! -f /app/db/custom.db ]; then cp /app/db-template/custom.db /app/db/custom.db && echo 'DB initialized'; fi && node /app/server.js"
