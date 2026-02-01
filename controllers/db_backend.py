import json
import sqlite3
from PyQt6.QtCore import QObject, pyqtSlot
from database.db import get_connection


class DatabaseBackend(QObject):
    """
    Backend that provides direct SQL access to the database from JavaScript.
    Allows executing SQL queries directly on cravehub.db
    """

    @pyqtSlot(str, result=str)
    def execute_query(self, sql_query):
        """
        Execute a SELECT query and return results as JSON.
        Returns array of objects (rows as dicts).
        """
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(sql_query)

            # Get column names
            columns = [description[0] for description in cursor.description]

            # Fetch all rows and convert to list of dicts
            rows = cursor.fetchall()
            result = [dict(zip(columns, row)) for row in rows]

            conn.close()
            return json.dumps(result)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @pyqtSlot(str, result=str)
    def execute_update(self, sql_query):
        """
        Execute INSERT, UPDATE, or DELETE queries.
        Returns JSON with success status and affected rows.
        """
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(sql_query)
            affected_rows = cursor.rowcount
            conn.commit()
            conn.close()
            return json.dumps({"success": True, "affected_rows": affected_rows})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    @pyqtSlot(str, result=str)
    def execute_many(self, sql_query, params_json):
        """
        Execute a query with parameters (for prepared statements).
        params_json should be a JSON array of parameter arrays.
        """
        try:
            conn = get_connection()
            cursor = conn.cursor()
            params = json.loads(params_json)
            cursor.executemany(sql_query, params)
            affected_rows = cursor.rowcount
            conn.commit()
            conn.close()
            return json.dumps({"success": True, "affected_rows": affected_rows})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    @pyqtSlot(str, str, result=str)
    def execute_with_params(self, sql_query, params_json):
        """
        Execute a single query with parameters.
        params_json should be a JSON array of parameter values.
        Returns last_insert_id for INSERT queries.
        """
        try:
            # Normalize inputs (QWebChannel may pass None or wrong type)
            if not isinstance(sql_query, str):
                sql_query = str(sql_query) if sql_query else ""
            if params_json is None or not isinstance(params_json, str):
                params_json = "[]"
            try:
                params = json.loads(params_json)
            except (json.JSONDecodeError, TypeError) as e:
                return json.dumps({"success": False, "error": f"Invalid params JSON: {e}"})
            if params is None:
                params = []
            elif not isinstance(params, (list, tuple)):
                params = [params]

            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(sql_query, params)

            # Check if it's a SELECT query
            if sql_query.strip().upper().startswith("SELECT"):
                if cursor.description:
                    columns = [d[0] for d in cursor.description]
                    rows = cursor.fetchall()
                    result = [dict(zip(columns, row)) for row in rows]
                else:
                    result = []
                conn.close()
                return json.dumps(result)
            else:
                affected_rows = cursor.rowcount
                last_insert_id = cursor.lastrowid
                conn.commit()
                conn.close()
                return json.dumps(
                    {
                        "success": True,
                        "affected_rows": affected_rows,
                        "last_insert_id": last_insert_id,
                    }
                )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})
