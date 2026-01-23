import sqlite3
from database.db import get_connection
from datetime import datetime


class OrderModel:

    @staticmethod
    def create(order_type, total):
        conn = get_connection()
        conn.execute(
            "INSERT INTO orders (order_type, total, created_at) VALUES (?, ?, ?)",
            (order_type, total, datetime.now().isoformat()),
        )
        conn.commit()
        conn.close()


    @staticmethod
    def get_all():
        conn = get_connection()
        conn.row_factory = sqlite3.Row  # make rows accessible by column name
        cursor = conn.execute("SELECT * FROM orders")
        orders = [dict(row) for row in cursor.fetchall()]  # now each row is a dict
        conn.close()
        return orders
