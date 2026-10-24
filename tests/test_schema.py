"""Exercise schema idempotence and anonymous access in an isolated test DB."""

import os
from importlib import resources

import psycopg
import pytest
from psycopg.conninfo import conninfo_to_dict


@pytest.mark.skipif(
    not os.environ.get("FPL_TEST_DATABASE_URL"),
    reason="Isolated Postgres test URL not provided",
)
def test_schema_is_repeatable_and_refresh_status_is_public_read_only():
    url = os.environ["FPL_TEST_DATABASE_URL"]
    # Prevent accidentally treating the ordinary production DSN as a test DB.
    if not conninfo_to_dict(url).get("dbname", "").endswith("_test"):
        pytest.fail(
            "Schema tests require a dedicated database whose name ends in _test."
        )
    schema = resources.files("fpl_pipeline.db").joinpath("schema.sql").read_text()
    with psycopg.connect(url, connect_timeout=15) as conn:
        try:
            conn.execute(
                "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $$;"
            )
            conn.execute(schema)
            conn.execute(schema)
            conn.execute(
                "INSERT INTO data_refresh_status VALUES ('test', now(), now())"
            )
            conn.execute("SET LOCAL ROLE anon")
            assert conn.execute(
                "SELECT season FROM data_refresh_status"
            ).fetchone() == ("test",)
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute(
                    "INSERT INTO data_refresh_status VALUES ('denied', now(), now())"
                )
        finally:
            conn.rollback()
