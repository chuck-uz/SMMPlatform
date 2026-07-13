# Production image for DockHost (Next.js standalone + Prisma migrate on start).
FROM node:22-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    NEXTAUTH_SECRET="build-time-only" \
    NEXTAUTH_URL="http://localhost:3000"

RUN corepack enable && apk add --no-cache libc6-compat openssl

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm prisma generate && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

RUN corepack enable && apk add --no-cache libc6-compat openssl \
  && addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
# Prod deps include prisma CLI for migrate/seed
RUN pnpm install --frozen-lockfile --prod \
  && pnpm prisma generate

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
CMD ["/app/entrypoint.sh"]
