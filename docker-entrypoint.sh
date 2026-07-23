#!/bin/sh
set -e

mkdir -p /app/data

echo "[OsintFlow] Sincronizando base de datos SQLite..."
bunx prisma db push --skip-generate

echo "[OsintFlow] Iniciando el servidor Next.js..."
exec node server.js