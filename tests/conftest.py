import pytest


@pytest.fixture(autouse=True)
def _no_local_learned_model(tmp_path, monkeypatch):
    """Tests must not depend on a model trained on this machine."""
    monkeypatch.setattr("fpl_pipeline.advisor.learned.MODEL_DIR", str(tmp_path / "models"))
