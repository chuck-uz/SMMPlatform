#!/bin/sh
set -e

echo "[entrypoint] applying migrations..."
prisma migrate deploy

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] seeding admin user..."
  tsx prisma/seed.ts || echo "[entrypoint] seed failed (non-fatal)"
fi

echo "[entrypoint] starting Next.js..."
exec node server.js
