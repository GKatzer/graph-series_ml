"""
inference/main.py — эмбеддинг запросов пользователя (bge-small-en-v1.5)

Документы в Qdrant (series_texts.text из TMDB ETL: "{name}. {overview} Keywords: ...")
эмбеддятся БЕЗ префикса, поэтому запросы здесь кодируются с BGE query-инструкцией.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

log = logging.getLogger("inference")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)

MODEL_NAME = "BAAI/bge-small-en-v1.5"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "
_model: SentenceTransformer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model
    log.info("Loading model %s ...", MODEL_NAME)
    _model = SentenceTransformer(MODEL_NAME, device="cpu")
    log.info("✔ Model loaded")
    yield
    _model = None


app = FastAPI(title="TVKG Inference", lifespan=lifespan)


class EmbedRequest(BaseModel):
    text: str
    # True — поисковый запрос (добавляем QUERY_PREFIX); False — документ, кодируется как есть
    is_query: bool = True


class EmbedResponse(BaseModel):
    vector: list[float]


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    assert _model is not None, "Model not loaded"
    text = req.text
    # startswith — на случай, если вызывающий бэкенд уже добавил префикс сам
    if req.is_query and not text.startswith(QUERY_PREFIX):
        text = QUERY_PREFIX + text
    vector = _model.encode(text, normalize_embeddings=True).tolist()
    return EmbedResponse(vector=vector)


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "loaded": _model is not None}