"""Tests for inference/main.py with a stub model, so no weights or torch are needed.

The real SentenceTransformer is replaced before `main` is imported; the stub records the text it is asked
to encode and returns a deterministic unit vector, which lets the tests check the query-instruction logic.
"""
import math
import sys
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


class StubModel:
    def __init__(self, name, device=None):
        self.name = name
        self.device = device
        self.seen = []

    def encode(self, text, normalize_embeddings=False):
        self.seen.append((text, normalize_embeddings))
        raw = [float((sum(map(ord, text)) + i) % 7 + 1) for i in range(384)]
        norm = math.sqrt(sum(x * x for x in raw))

        class Vec(list):
            def tolist(self_inner):
                return list(self_inner)

        return Vec([x / norm for x in raw] if normalize_embeddings else raw)


@pytest.fixture()
def client(monkeypatch):
    fake = types.ModuleType("sentence_transformers")
    fake.SentenceTransformer = StubModel
    monkeypatch.setitem(sys.modules, "sentence_transformers", fake)
    sys.modules.pop("main", None)
    import main

    with TestClient(main.app) as c:
        c.main = main
        yield c
    sys.modules.pop("main", None)


def last_seen(client):
    return client.main._model.seen[-1]


def test_health_reports_the_loaded_model(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "model": "BAAI/bge-small-en-v1.5", "loaded": True}


def test_model_is_loaded_on_cpu(client):
    assert client.main._model.device == "cpu"


def test_query_gets_the_retrieval_instruction(client):
    client.post("/embed", json={"text": "space western"})
    assert last_seen(client)[0] == QUERY_PREFIX + "space western"


def test_is_query_defaults_to_true(client):
    client.post("/embed", json={"text": "x"})
    assert last_seen(client)[0].startswith(QUERY_PREFIX)


def test_instruction_is_not_added_twice(client):
    client.post("/embed", json={"text": QUERY_PREFIX + "space western", "is_query": True})
    assert last_seen(client)[0] == QUERY_PREFIX + "space western"


def test_documents_are_encoded_as_they_are(client):
    client.post("/embed", json={"text": "a document", "is_query": False})
    assert last_seen(client)[0] == "a document"


def test_vector_has_384_numbers_and_unit_length(client):
    v = client.post("/embed", json={"text": "hello"}).json()["vector"]
    assert len(v) == 384
    assert math.isclose(math.sqrt(sum(x * x for x in v)), 1.0, rel_tol=1e-9)


def test_encoder_is_asked_for_normalised_output(client):
    client.post("/embed", json={"text": "hello"})
    assert last_seen(client)[1] is True


def test_missing_text_is_rejected(client):
    assert client.post("/embed", json={}).status_code == 422
