#!/usr/bin/env python3
"""
init_qdrant.py
~~~~~~~~~~~~~~
Создаёт коллекцию Qdrant для TV Series Knowledge Graph.

Параметры:
  - 384 измерения (bge-small-en-v1.5)
  - HNSW индекс
  - Scalar quantization (int8) — экономия ~4x RAM
  - Payload индексы на tmdb_id и name

Схема точек (TMDB ETL, qdrant_loader.py):
  - point id = tmdb_id (int) = Neo4j (:Series).tmdb_id
  - payload: { tmdb_id, name, overview, imdb_id, start_year }
  - ~211k точек (все сериалы с текстом), а не только графовые ~56k

Требует qdrant-client==1.9.2 — версия должна совпадать с сервером (qdrant/qdrant:v1.9.2),
иначе gRPC-вектора читаются сервером как пустые ("expected dim: 384, got 0").

Запуск:
  python init_qdrant.py
  python init_qdrant.py --host 100.x.x.x  # Tailscale IP VDS2
  python init_qdrant.py --recreate         # пересоздать если уже есть
"""

from __future__ import annotations

import argparse
import logging
import sys

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    HnswConfigDiff,
    PayloadSchemaType,
    ScalarQuantization,
    ScalarQuantizationConfig,
    ScalarType,
    VectorParams,
)

log = logging.getLogger("init_qdrant")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")

COLLECTION_NAME = "graph-series"
VECTOR_SIZE = 384          # bge-small-en-v1.5
DISTANCE = Distance.COSINE


def create_collection(client: QdrantClient, recreate: bool = False) -> None:
    exists = client.collection_exists(COLLECTION_NAME)

    if exists:
        if recreate:
            log.warning("Коллекция '%s' уже существует — удаляем и пересоздаём.", COLLECTION_NAME)
            client.delete_collection(COLLECTION_NAME)
        else:
            log.info("Коллекция '%s' уже существует. Используй --recreate для пересоздания.", COLLECTION_NAME)
            info = client.get_collection(COLLECTION_NAME)
            log.info("  Векторов: %d", info.vectors_count or 0)
            return

    log.info("Создаём коллекцию '%s'...", COLLECTION_NAME)
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(
            size=VECTOR_SIZE,
            distance=DISTANCE,
            # on_disk=True — если коллекция не влезает в RAM (у нас влезает: 211k × 384 × 4B ≈ 320MB)
            on_disk=False,
        ),
        # HNSW — баланс скорость/качество поиска
        hnsw_config=HnswConfigDiff(
            m=16,              # рёбер на узел (16 — стандарт для сотен тысяч точек)
            ef_construct=100,  # точность индексации (100 — стандарт)
            full_scan_threshold=10_000,
        ),
        # Scalar quantization int8 — экономия RAM ~4x при минимальной потере качества
        quantization_config=ScalarQuantization(
            scalar=ScalarQuantizationConfig(
                type=ScalarType.INT8,
                quantile=0.99,     # 1% выбросов не квантизируем
                always_ram=True,   # квантизированные векторы всегда в RAM
            )
        ),
        # Хранить оригиналы на диске (они нужны только для точного ре-ранкинга)
        optimizers_config=None,
    )
    log.info("✔ Коллекция создана.")

    # Payload индексы — для фильтрации (join с Neo4j идёт по point id == tmdb_id)
    log.info("Создаём payload индексы...")
    client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="tmdb_id",
        field_schema=PayloadSchemaType.INTEGER,
    )
    client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="name",
        field_schema=PayloadSchemaType.TEXT,
    )
    log.info("✔ Индексы созданы.")

    info = client.get_collection(COLLECTION_NAME)
    log.info("Итог: %s", info.status)


def main() -> None:
    parser = argparse.ArgumentParser(description="Инициализация коллекции Qdrant")
    parser.add_argument("--host", default="localhost", help="Qdrant host (default: localhost)")
    parser.add_argument("--port", type=int, default=6333, help="Qdrant port (default: 6333)")
    parser.add_argument("--recreate", action="store_true", help="Пересоздать коллекцию если уже есть")
    args = parser.parse_args()

    log.info("Подключаемся к Qdrant: %s:%d", args.host, args.port)
    client = QdrantClient(host=args.host, port=args.port, timeout=30)

    try:
        # Проверяем живость
        client.get_collections()
        log.info("Qdrant доступен.")
    except Exception as exc:
        log.error("Не удалось подключиться к Qdrant: %s", exc)
        sys.exit(1)

    create_collection(client, recreate=args.recreate)


if __name__ == "__main__":
    main()