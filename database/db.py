import sqlite3
import sys
import os
from pathlib import Path

# Determine base directory - works for both development and PyInstaller bundle
if getattr(sys, "frozen", False):
    # Running as compiled executable
    BASE_DIR = Path(sys._MEIPASS)
    # Database should be stored next to the executable, not in temp folder
    EXE_DIR = Path(sys.executable).parent
    DB_PATH = EXE_DIR / "cravehub.db"
    SCHEMA_PATH = BASE_DIR / "database" / "schema.sql"
else:
    # Running as script
    BASE_DIR = Path(__file__).resolve().parent.parent
    DB_PATH = BASE_DIR / "cravehub.db"
    SCHEMA_PATH = BASE_DIR / "database" / "schema.sql"


def get_connection():
    """
    Returns a SQLite connection and ensures schema is initialized.
    Database is stored next to the executable in production, or in project root in development.
    """
    conn = sqlite3.connect(str(DB_PATH))
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
