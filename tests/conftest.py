import pytest


@pytest.fixture(autouse=True)
def _no_learned_model(tmp_path, monkeypatch):
    """Context tests must not depend on a model trained on this machine or on
    predictions published to a warehouse; learned tests call these directly."""
    monkeypatch.setattr("fpl_pipeline.advisor.learned.MODEL_DIR", str(tmp_path / "models"))
    monkeypatch.setattr(
        "fpl_pipeline.advisor.context.load_published",
        lambda *args, **kwargs: ({}, {"status": "absent", "reason": "No published predictions."}),
    )
