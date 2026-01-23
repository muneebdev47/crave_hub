import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "cravehub.db"
SCHEMA_PATH = BASE_DIR / "database" / "schema.sql"


def get_connection():
    """
    Returns a SQLite connection and ensures schema is initialized.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    _initialize_db(conn)
    return conn


def _initialize_db(conn):
    """
    Creates tables if they do not exist.
    Runs only once per database.
    """
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='users';
    """
    )

    if cursor.fetchone():
        return  # DB already initialized

    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    conn.commit()
