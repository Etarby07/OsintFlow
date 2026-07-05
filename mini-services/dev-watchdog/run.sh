#!/bin/bash
# Watchdog que mantiene el dev server de OsintFlow vivo.
# Si el servidor se cae (OOM kill, crash, etc.), lo reinicia automáticamente.

cd /home/z/my-project

while true; do
  echo "[watchdog] $(date) Iniciando dev server..."
  ./node_modules/.bin/next dev -p 3000 > dev.log 2>&1
  EXIT_CODE=$?
  echo "[watchdog] $(date) Servidor terminó (código $EXIT_CODE). Reiniciando en 2s..."
  sleep 2
done
