import json
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from .demo_data import DEMO_CARDS, DEMO_LAB_INSTANCES, DEMO_LOGS, DEMO_PROJECTS, DEMO_ROOMS


APP_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = APP_DIR / "data"
DB_PATH = DATA_DIR / "researchdino.sqlite3"

TABLES = {
    "projects": DEMO_PROJECTS,
    "lab_instances": DEMO_LAB_INSTANCES,
    "rooms": DEMO_ROOMS,
    "cards": DEMO_CARDS,
    "agent_logs": DEMO_LOGS,
    "leader_decisions": [],
    "library_entries": [],
    "claims": [],
    "evidence_items": [],
    "debate_sessions": [],
    "hypotheses": [],
    "experiment_plans": [],
    "agent_runs": [],
    "agent_messages": [],
    "research_runs": [],
    "ingest_folders": [],
    "paper_files": [],
    "paper_texts": [],
}

SEARCHABLE_TABLES = {
    "library_entries",
    "cards",
    "claims",
    "evidence_items",
    "paper_files",
    "paper_texts",
    "leader_decisions",
}


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout = 30000")
    return connection


@contextmanager
def connection_scope() -> Iterator[sqlite3.Connection]:
    connection = connect()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db() -> None:
    with connection_scope() as connection:
        connection.execute("PRAGMA journal_mode = WAL")
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
        connection.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS research_fts USING fts5(
                record_id UNINDEXED,
                record_type UNINDEXED,
                project_id UNINDEXED,
                lab_id UNINDEXED,
                title,
                body
            )
            """
        )
        for table, rows in TABLES.items():
            for row in rows:
                if get_json_with_connection(connection, table, row["id"]) is None:
                    upsert_json(connection, table, row["id"], row)
        for table in SEARCHABLE_TABLES:
            for row in connection.execute(f"SELECT id, payload FROM {table}").fetchall():
                sync_search_record(connection, table, row["id"], json.loads(row["payload"]))


def count_rows(connection: sqlite3.Connection, table: str) -> int:
    row = connection.execute(f"SELECT COUNT(*) AS count FROM {table}").fetchone()
    return int(row["count"])


def list_json(table: str) -> list[dict[str, Any]]:
    with connection_scope() as connection:
        rows = connection.execute(f"SELECT payload FROM {table} ORDER BY created_at ASC").fetchall()
    return [json.loads(row["payload"]) for row in rows]


def get_json(table: str, item_id: str) -> dict[str, Any] | None:
    with connection_scope() as connection:
        return get_json_with_connection(connection, table, item_id)


def get_json_with_connection(
    connection: sqlite3.Connection,
    table: str,
    item_id: str,
) -> dict[str, Any] | None:
    row = connection.execute(f"SELECT payload FROM {table} WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        return None
    return json.loads(row["payload"])


def put_json(table: str, item_id: str, payload: dict[str, Any]) -> None:
    with connection_scope() as connection:
        upsert_json(connection, table, item_id, payload)


def delete_json(table: str, item_id: str) -> bool:
    with connection_scope() as connection:
        cursor = connection.execute(f"DELETE FROM {table} WHERE id = ?", (item_id,))
        if table in SEARCHABLE_TABLES:
            connection.execute(
                "DELETE FROM research_fts WHERE record_type = ? AND record_id = ?",
                (table, item_id),
            )
        return cursor.rowcount > 0


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
    if table in SEARCHABLE_TABLES:
        sync_search_record(connection, table, item_id, payload)


def _flatten_search_text(value: Any) -> str:
    if isinstance(value, dict):
        return " ".join(f"{key} {_flatten_search_text(item)}" for key, item in value.items())
    if isinstance(value, list):
        return " ".join(_flatten_search_text(item) for item in value)
    return str(value) if value is not None else ""


def sync_search_record(
    connection: sqlite3.Connection,
    table: str,
    item_id: str,
    payload: dict[str, Any],
) -> None:
    if table not in SEARCHABLE_TABLES:
        return
    connection.execute(
        "DELETE FROM research_fts WHERE record_type = ? AND record_id = ?",
        (table, item_id),
    )
    title = str(payload.get("title") or payload.get("fileName") or payload.get("text") or "")
    body = _flatten_search_text(payload)
    connection.execute(
        """
        INSERT INTO research_fts(record_id, record_type, project_id, lab_id, title, body)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            item_id,
            table,
            str(payload.get("projectId") or ""),
            str(payload.get("labId") or ""),
            title,
            body,
        ),
    )


def search_records(
    query: str,
    *,
    record_types: set[str] | None = None,
    project_id: str | None = None,
    lab_id: str | None = None,
) -> list[dict[str, Any]]:
    tokens = re.findall(r"[\w.-]+", query, flags=re.UNICODE)
    if not tokens:
        return []
    match_query = " AND ".join(f'"{token.replace(chr(34), "")}"*' for token in tokens)
    clauses = ["research_fts MATCH ?"]
    params: list[Any] = [match_query]
    if record_types:
        placeholders = ", ".join("?" for _ in record_types)
        clauses.append(f"record_type IN ({placeholders})")
        params.extend(sorted(record_types))
    if project_id:
        clauses.append("project_id = ?")
        params.append(project_id)
    if lab_id:
        clauses.append("lab_id = ?")
        params.append(lab_id)
    with connection_scope() as connection:
        rows = connection.execute(
            "SELECT record_id, record_type, project_id, lab_id, title, body FROM research_fts WHERE "
            + " AND ".join(clauses)
            + " ORDER BY bm25(research_fts), title",
            params,
        ).fetchall()
    return [dict(row) for row in rows]
