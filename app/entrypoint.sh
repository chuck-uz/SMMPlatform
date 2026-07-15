#!/bin/sh
set -e

echo "[entrypoint] applying migrations..."
# Postgres may not be accepting connections the instant the app container starts
# (e.g. the db container is still booting). Retry so `set -e` doesn't crash the
# whole container on a transient "connection refused".
i=0
until prisma migrate deploy; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[entrypoint] migrations still failing after $i attempts, giving up"
    exit 1
  fi
  echo "[entrypoint] database not ready, retrying migrate ($i/30)..."
  sleep 2
done

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] seeding admin user..."
  tsx prisma/seed.ts || echo "[entrypoint] seed failed (non-fatal)"
fi

echo "[entrypoint] starting Next.js..."
exec node server.js
