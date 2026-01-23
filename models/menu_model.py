from database.db import get_connection


class MenuModel:

    @staticmethod
    def get_all():
        conn = get_connection()
        items = conn.execute("SELECT * FROM menu_items").fetchall()
        conn.close()
        return items

    @staticmethod
    def create(name, category, price):
        conn = get_connection()
        conn.execute(
            "INSERT INTO menu_items (name, category, price) VALUES (?, ?, ?)",
            (name, category, price),
        )
        conn.commit()
        conn.close()
