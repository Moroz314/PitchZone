#!/bin/sh

# =========================================================================
# Amvera Cloud Start Router
# =========================================================================

# Проверяем переменную SERVICE_NAME
if [ -z "$SERVICE_NAME" ]; then
  echo "==================================================================="
  echo "❌ FATAL ERROR: SERVICE_NAME environment variable is not set!"
  echo "You must set SERVICE_NAME in the Amvera Cloud project settings."
  echo "Valid values are: 'api', 'worker', or 'web'."
  echo "==================================================================="
  exit 1
fi

echo "==================================================================="
echo "🚀 Bootstrapping Amvera instance..."
echo "👉 Detected SERVICE_NAME: '$SERVICE_NAME'"
echo "==================================================================="

# Запускаем нужный процесс (и ТОЛЬКО ЕГО)
if [ "$SERVICE_NAME" = "api" ]; then
  echo "[SYSTEM] Starting as API (Nest.js Backend)..."
  # Переходим в директорию API и запускаем команду старта
  cd /app/apps/api
  
  # Применяем миграции (удобно для Amvera, чтобы при деплое API БД обновлялась автоматически)
  echo "[SYSTEM] Running Prisma migrations..."
  npx prisma migrate deploy

  echo "[SYSTEM] Seeding database..."
  npx prisma db seed
  
  echo "[SYSTEM] Starting NestJS production server..."
  exec npm run start:prod

elif [ "$SERVICE_NAME" = "worker" ]; then
  echo "[SYSTEM] Starting as WORKER (Background Tasks)..."
  cd /app/apps/api
  exec npm run start:worker:prod

elif [ "$SERVICE_NAME" = "web" ]; then
  echo "[SYSTEM] Starting as WEB (Next.js Frontend)..."
  # Next.js standalone собирается в /app/apps/web/server.js
  cd /app/apps/web
  exec node server.js

else
  echo "==================================================================="
  echo "❌ FATAL ERROR: Invalid SERVICE_NAME value: '$SERVICE_NAME'"
  echo "Expected one of: 'api', 'worker', 'web'"
  echo "==================================================================="
  exit 1
fi
