
import sqlite3
import json

from pathlib import Path
from datetime import datetime, timezone


DATABASE_PATH = Path(__file__).resolve().parent / "feednest.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():

    with get_connection() as connection:

        connection.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                created_at TEXT NOT NULL,
                results_json TEXT NOT NULL
            )
        """)


def save_analysis(filename: str, results: dict) -> int:

    created_at = datetime.now(timezone.utc).isoformat()

    results_json = json.dumps(
        results,
        ensure_ascii=False
    )

    with get_connection() as connection:

        cursor = connection.execute(
            """
            INSERT INTO analyses (
                filename,
                created_at,
                results_json
            )
            VALUES (?, ?, ?)
            """,
            (filename, created_at, results_json)
        )

        return cursor.lastrowid


def get_analysis(analysis_id: int):

    with get_connection() as connection:

        row = connection.execute(
            """
            SELECT * FROM analyses
            WHERE id = ?
            """,
            (analysis_id,)
        ).fetchone()

    if row is None:
        return None

    return {
        "id": row["id"],
        "filename": row["filename"],
        "created_at": row["created_at"],
        "results": json.loads(row["results_json"])
    }


def get_analysis_history():

    with get_connection() as connection:

        rows = connection.execute(
            """
            SELECT id, filename, created_at
            FROM analyses
            ORDER BY id DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]
