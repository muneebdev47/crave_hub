import json
from PyQt6.QtCore import QObject, pyqtSlot
from database.db import get_connection


class MenuBackend(QObject):
    """
    Backend for menu operations using direct database access.
    Note: Most JavaScript code now uses dbBackend directly, but this is kept
    for backward compatibility and potential future use.
    """

    @pyqtSlot(result=str)
    def get_menu_items(self):
        """Return all menu items as JSON string"""
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, name, category, price, is_available FROM menu_items ORDER BY category, name"
            )

            columns = [description[0] for description in cursor.description]
            rows = cursor.fetchall()
            result = [dict(zip(columns, row)) for row in rows]

            conn.close()
            return json.dumps(result)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @pyqtSlot(int, result=str)
    def get_item(self, item_id):
        """Get a single item by id"""
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, name, category, price, is_available FROM menu_items WHERE id = ?",
                (item_id,),
            )

            columns = [description[0] for description in cursor.description]
            row = cursor.fetchone()

            if row:
                result = dict(zip(columns, row))
            else:
                result = None

            conn.close()
            return json.dumps(result)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @pyqtSlot(str, str, float)
    def add_item(self, name, category, price):
        """Add a new menu item"""
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO menu_items (name, category, price, is_available) VALUES (?, ?, ?, 1)",
                (name, category, price),
            )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error adding menu item: {e}")

    @pyqtSlot(int, str, str, float)
    def update_item(self, item_id, name, category, price):
        """Update an existing menu item"""
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE menu_items SET name = ?, category = ?, price = ? WHERE id = ?",
                (name, category, price, item_id),
            )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error updating menu item: {e}")

    @pyqtSlot(int)
    def delete_item(self, item_id):
        """Delete a menu item"""
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM menu_items WHERE id = ?", (item_id,))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error deleting menu item: {e}")
