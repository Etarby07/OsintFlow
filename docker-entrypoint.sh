#!/bin/sh
set -e

# Ensure the data directory exists.
mkdir -p /app/data

# Push the Prisma schema to the SQLite database (creates the file if missing).
echo "[OsintFlow] Sincronizando base de datos SQLite..."
bunx prisma db push --skip-generate || npx prisma db push --skip-generate

echo "[OsintFlow] Iniciando servidor en http://0.0.0.0:${PORT}"
exec node server.js
