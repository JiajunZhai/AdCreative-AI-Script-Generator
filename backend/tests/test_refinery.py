import pytest
import refinery

def test_distill_and_store_raises_when_api_key_missing(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    with pytest.raises(Exception, match="DeepSeek API Key missing"):
        refinery.distill_and_store(raw_text="abc", source_url="", year_quarter="2024-Q1")

def test_retrieve_context_returns_empty_on_db_error(monkeypatch):
    class BrokenCollection:
        def query(self, *args, **kwargs):
            raise RuntimeError("db down")

    monkeypatch.setattr(refinery, "collection", BrokenCollection())
    context, citations = refinery.retrieve_context("query")
    assert context == ""
    assert citations == []
