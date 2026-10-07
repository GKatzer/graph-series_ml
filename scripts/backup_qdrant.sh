#!/usr/bin/env bash
# =============================================================
#  backup_qdrant.sh — еженедельный snapshot коллекции Qdrant
#  Запускается через cron или systemd timer.
#  Snapshot хранится в volume qdrant_snapshots (примонтирован в контейнер).
# =============================================================

set -euo pipefail

COLLECTION="graph-series"
QDRANT_URL="http://localhost:6333"
BACKUP_DIR="/home/graph_series_ml/vds2/backups/qdrant"
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "=== Qdrant backup | $(date '+%Y-%m-%d %H:%M:%S') ==="

# 1. Создаём snapshot через REST API
echo "Создаём snapshot коллекции '$COLLECTION'..."
RESPONSE=$(curl -sf -X POST \
    "$QDRANT_URL/collections/$COLLECTION/snapshots" \
    -H "Content-Type: application/json")

SNAPSHOT_NAME=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['name'])")
echo "Snapshot создан: $SNAPSHOT_NAME"

# 2. Скачиваем snapshot на хост
echo "Скачиваем snapshot..."
FILENAME="qdrant_${COLLECTION}_$(date '+%Y%m%d_%H%M%S').snapshot"
curl -sf -o "$BACKUP_DIR/$FILENAME" \
    "$QDRANT_URL/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME"

echo "✔ Сохранено: $BACKUP_DIR/$FILENAME ($(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1))"

# 3. Удаляем snapshot из Qdrant (освобождаем место в volume)
curl -sf -X DELETE \
    "$QDRANT_URL/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME" > /dev/null
echo "Snapshot удалён из Qdrant."

# 4. Ротация — удаляем старые бэкапы
find "$BACKUP_DIR" -name "*.snapshot" -mtime "+$KEEP_DAYS" -delete
echo "Ротация: удалены файлы старше $KEEP_DAYS дней."

echo "=== Backup завершён ==="
ls -lh "$BACKUP_DIR"