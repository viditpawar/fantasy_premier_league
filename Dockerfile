FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml ./
COPY src/ ./src/

RUN pip install --no-cache-dir .

CMD ["sh", "-c", "python -m fpl_pipeline.db.connection && python -m fpl_pipeline.ingest.live"]
