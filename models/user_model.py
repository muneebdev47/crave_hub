from database.db import get_connection


class UserModel:

    @staticmethod
    def get_all():
        conn = get_connection()
        users = conn.execute("SELECT * FROM users").fetchall()
        conn.close()
        return users

    @staticmethod
    def create(username, role):
        conn = get_connection()
        conn.execute(
            "INSERT INTO users (username, role) VALUES (?, ?)", (username, role)
        )
        conn.commit()
        conn.close()
