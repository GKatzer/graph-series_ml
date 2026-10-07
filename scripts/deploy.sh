#!/usr/bin/env bash
# =============================================================
#  deploy.sh — деплой VDS2 (Search & Frontend)
#  Запускается из GitHub Actions через SSH.
#  На VDS2: /home/graph_series_ml/vds2/scripts/deploy.sh
# =============================================================

set -euo pipefail

PROJECT_DIR="/home/graph_series_ml/vds2"
COMPOSE="docker compose -f $PROJECT_DIR/docker-compose.yml"
BRANCH="${1:-main}"

echo "=== Deploy VDS2 | branch: $BRANCH | $(date '+%Y-%m-%d %H:%M:%S') ==="

# 1. Переходим в директорию проекта
cd "$PROJECT_DIR"

# 2. Получаем свежий код
echo "--- git pull ---"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# 3. Пересобираем только Next.js (Qdrant и Caddy не меняются)
echo "--- docker build: nextjs ---"
$COMPOSE build --no-cache nextjs

# 4. Zero-downtime: поднимаем новый контейнер, потом останавливаем старый
echo "--- rolling restart: nextjs ---"
$COMPOSE up -d --no-deps nextjs

# 5. Кадди перечитывает конфиг без рестарта (если Caddyfile изменился)
echo "--- caddy reload ---"
$COMPOSE exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true

# 6. Ждём health-check Next.js
echo "--- waiting for nextjs health ---"
MAX_WAIT=60
ELAPSED=0
until curl -sf http://localhost:3000/api/healthz > /dev/null 2>&1; do
    if [ $ELAPSED -ge $MAX_WAIT ]; then
        echo "ОШИБКА: Next.js не поднялся за ${MAX_WAIT}s"
        $COMPOSE logs --tail=50 nextjs
        exit 1
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
done
echo "✔ Next.js healthy (${ELAPSED}s)"

# 7. Удаляем старые образы
echo "--- docker prune ---"
docker image prune -f

echo "=== Deploy завершён ==="
$COMPOSE ps