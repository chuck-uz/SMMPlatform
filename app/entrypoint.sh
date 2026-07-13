#!/bin/sh
set -e

echo "[entrypoint] applying migrations..."
pnpm prisma migrate deploy

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] seeding admin user..."
  pnpm prisma db seed || echo "[entrypoint] seed failed (non-fatal)"
fi

echo "[entrypoint] starting Next.js..."
exec node server.js
