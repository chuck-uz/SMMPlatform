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

# Only migrate/seed tooling — not the full Next.js dependency tree.
FROM node:22-alpine AS prisma-tools
WORKDIR /opt/prisma-tools
RUN apk add --no-cache libc6-compat openssl
RUN printf '%s\n' \
  '{' \
  '  "name": "prisma-tools",' \
  '  "private": true,' \
  '  "dependencies": {' \
  '    "prisma": "7.8.0",' \
  '    "@prisma/client": "7.8.0",' \
  '    "@prisma/adapter-pg": "7.8.0",' \
  '    "pg": "8.22.0",' \
  '    "tsx": "4.23.0",' \
  '    "dotenv": "17.4.2",' \
  '    "bcryptjs": "3.0.3"' \
  '  }' \
  '}' > package.json \
  && npm install --omit=dev \
  && npm cache clean --force \
  && rm -rf /root/.npm /tmp/*

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PATH="/app/node_modules/.bin:$PATH"

RUN apk add --no-cache libc6-compat openssl \
  && addgroup -S nodejs && adduser -S nextjs -G nodejs

# Next.js standalone runtime (no full pnpm install --prod).
# --chown at copy time avoids a second full-size layer from a later `chown -R`.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma schema/migrations + generated client for migrate/seed.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

# Placed at ./node_modules (not a separate dir) so standard Node resolution
# finds it from any file under /app — NODE_PATH only helps CJS require(),
# not the ESM imports tsx/the generated Prisma client use.
# A plain COPY here fails: the Next standalone trace already left some of
# these package names in place as broken/partial entries, and BuildKit's
# COPY refuses to merge a directory over a non-directory. Clear each
# colliding top-level name first, then copy; chown happens in the same
# layer so this doesn't add a second full-size layer like `chown -R` would.
RUN --mount=type=bind,from=prisma-tools,source=/opt/prisma-tools/node_modules,target=/mnt/prisma-tools-modules \
  sh -c 'for d in /mnt/prisma-tools-modules/*; do rm -rf "./node_modules/$(basename "$d")"; done \
  && cp -a /mnt/prisma-tools-modules/. ./node_modules/ \
  && chown -R nextjs:nodejs ./node_modules'

COPY --chown=nextjs:nodejs entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER nextjs
EXPOSE 3000
CMD ["/app/entrypoint.sh"]
