import asyncio
import math

from app.rag_embeddings import GeminiEmbedder


def test_document_embeddings_are_768_dimensions_and_normalized(monkeypatch) -> None:
    captured = {}
    raw_vector = [3.0, 4.0] + [0.0] * 766

    class FakeModels:
        async def embed_content(self, **kwargs):
            captured.update(kwargs)
            embedding = type("Embedding", (), {"values": raw_vector})()
            return type("Response", (), {"embeddings": [embedding]})()

    class FakeAsyncClient:
        models = FakeModels()

        async def aclose(self):
            captured["closed"] = True

    class FakeClient:
        def __init__(self, api_key):
            captured["has_api_key"] = bool(api_key)
            self.aio = FakeAsyncClient()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("app.rag_embeddings.genai.Client", FakeClient)
    embedder = GeminiEmbedder()

    vectors = asyncio.run(embedder.embed_documents(["Creatinine is used in renal evaluation."]))
    asyncio.run(embedder.close())

    assert len(vectors) == 1
    assert len(vectors[0]) == 768
    assert math.isclose(sum(value * value for value in vectors[0]), 1.0)
    assert captured["config"].output_dimensionality == 768
    assert str(captured["config"].task_type).endswith("RETRIEVAL_DOCUMENT")
    assert captured["closed"] is True
