import json
import sqlite3
from pathlib import Path
from typing import Any

from .demo_data import DEMO_CARDS, DEMO_LOGS, DEMO_ROOMS


APP_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = APP_DIR / "data"
DB_PATH = DATA_DIR / "researchdino.sqlite3"

TABLES = {
    "rooms": DEMO_ROOMS,
    "cards": DEMO_CARDS,
    "agent_logs": DEMO_LOGS,
    "leader_decisions": [],
    "library_entries": [],
    "ingest_folders": [],
    "paper_files": [],
    "paper_texts": [],
}


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with connect() as connection:
        for table in TABLES:
            connection.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {table} (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        for table, rows in TABLES.items():
            if rows and count_rows(connection, table) == 0:
                for row in rows:
                    upsert_json(connection, table, row["id"], row)


def count_rows(connection: sqlite3.Connection, table: str) -> int:
    row = connection.execute(f"SELECT COUNT(*) AS count FROM {table}").fetchone()
    return int(row["count"])


def list_json(table: str) -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute(f"SELECT payload FROM {table} ORDER BY created_at ASC").fetchall()
    return [json.loads(row["payload"]) for row in rows]


def get_json(table: str, item_id: str) -> dict[str, Any] | None:
    with connect() as connection:
        row = connection.execute(f"SELECT payload FROM {table} WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        return None
    return json.loads(row["payload"])


def put_json(table: str, item_id: str, payload: dict[str, Any]) -> None:
    with connect() as connection:
        upsert_json(connection, table, item_id, payload)


def upsert_json(
    connection: sqlite3.Connection,
    table: str,
    item_id: str,
    payload: dict[str, Any],
) -> None:
    connection.execute(
        f"""
        INSERT INTO {table} (id, payload)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET
            payload = excluded.payload,
            updated_at = CURRENT_TIMESTAMP
        """,
        (item_id, json.dumps(payload, ensure_ascii=True)),
    )
