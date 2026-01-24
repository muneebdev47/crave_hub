"""
DEPRECATED: This script is kept for reference.
Please use seed_database.py instead, which seeds:
- 4 users (admin, manager, staff, cashier)
- All menu items
- 10 orders with order items

Run: python database/seed_database.py
"""

import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "cravehub.db"

menu_items = [
    # Pizza
    ("Chicken Tikka - S", "Pizza", 350),
    ("Chicken Tikka - M", "Pizza", 850),
    ("Chicken Tikka - L", "Pizza", 1299),
    ("Chicken Fajita - S", "Pizza", 350),
    ("Chicken Fajita - M", "Pizza", 850),
    ("Chicken Fajita - L", "Pizza", 1299),
    ("Vegetarian Pizza - S", "Pizza", 350),
    ("Vegetarian Pizza - M", "Pizza", 850),
    ("Vegetarian Pizza - L", "Pizza", 1299),
    ("Fajita Sicilian - S", "Pizza", 350),
    ("Fajita Sicilian - M", "Pizza", 850),
    ("Fajita Sicilian - L", "Pizza", 1299),
    ("Cheese Lover - S", "Pizza", 350),
    ("Cheese Lover - M", "Pizza", 850),
    ("Cheese Lover - L", "Pizza", 1299),
    # CraveHub Special
    ("CraveHub Special - S", "CraveHub Special", 400),
    ("CraveHub Special - M", "CraveHub Special", 950),
    ("CraveHub Special - L", "CraveHub Special", 1399),
    ("All in 1 Pizza - S", "CraveHub Special", 400),
    ("All in 1 Pizza - M", "CraveHub Special", 950),
    ("All in 1 Pizza - L", "CraveHub Special", 1399),
    ("Behari Kabab Pizza - S", "CraveHub Special", 400),
    ("Behari Kabab Pizza - M", "CraveHub Special", 950),
    ("Behari Kabab Pizza - L", "CraveHub Special", 1399),
    ("Malai Boti Pizza - S", "CraveHub Special", 400),
    ("Malai Boti Pizza - M", "CraveHub Special", 950),
    ("Malai Boti Pizza - L", "CraveHub Special", 1399),
    # Chinese/Oriental
    ("Thai Sweet Chilli Chicken", "Chinese/Oriental", 900),
    ("Thai Chicken Chilli Dry", "Chinese/Oriental", 950),
    ("Thai Stir/Fried Veggies & Ch", "Chinese/Oriental", 850),
    ("Cashew Nut Chicken", "Chinese/Oriental", 1000),
    ("Chicken Manchurian", "Chinese/Oriental", 800),
    ("Kung Pao Chicken", "Chinese/Oriental", 800),
    ("Chicken Chowmein", "Chinese/Oriental", 500),
]

if __name__ == "__main__":
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for name, category, price in menu_items:
        try:
            cursor.execute(
                "INSERT INTO menu_items (name, category, price, is_available) VALUES (?, ?, ?, 1)",
                (name, category, price),
            )
        except sqlite3.IntegrityError:
            print(f"Menu item {name} already exists, skipping...")

    conn.commit()
    conn.close()
    print("Menu items added successfully!")
