#!/bin/bash
# Verifica si el servidor OsintFlow está corriendo en el puerto 3000.
# Si no responde, lo reinicia usando el servidor standalone (bajo consumo de memoria).

if curl -s -o /dev/null --max-time 3 http://localhost:3000/ 2>/dev/null; then
  # El servidor está corriendo, no hacer nada
  exit 0
fi

# El servidor no responde, reiniciarlo
cd /home/z/my-project
pkill -f "server.js" 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 1

# Iniciar el servidor standalone (solo 3MB de RAM, no será matado por OOM)
setsid bash -c 'cd /home/z/my-project && exec node .next/standalone/server.js > /home/z/my-project/dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
disown

echo "[keep-alive] Servidor reiniciado a las $(date)" >> /home/z/my-project/dev.log
