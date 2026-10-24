from importlib import resources

import psycopg

from fpl_pipeline.config import DATABASE_URL


def get_connection() -> psycopg.Connection:
    if not DATABASE_URL:
        raise ValueError("Set DATABASE_URL (or SUPABASE_DATABASE_URL) before using the warehouse.")
    return psycopg.connect(DATABASE_URL, connect_timeout=15)


def init_schema() -> None:
    schema_sql = resources.files("fpl_pipeline.db").joinpath("schema.sql").read_text()
    with get_connection() as conn:
        conn.execute(schema_sql)
        conn.commit()


if __name__ == "__main__":
    init_schema()
    print("Schema applied.")
