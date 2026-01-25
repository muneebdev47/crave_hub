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
    # Sandwiches
    ("Grilled Cheese Sandwich", "Sandwiches", 600, 1),
    ("Steaks Grilled Sandwich", "Sandwiches", 600),
    ("Steak Height Sandwich", "Sandwiches", 450),
    ("Mexican Grilled Sandwich", "Sandwiches", 500),
    ("Club Tym Sandwich", "Sandwiches", 450),
    # Soup
    ("Hot & sour", "Soup", 250),
    ("Chicken corn soup", "Soup", 250),
    ("19-B soup", "Soup", 300),
    ("Szechuan soup", "Soup", 300),
    # Appetizers
    ("Prawn Tempura", "Appetizer", 1200),
    ("Chilli fried prawn", "Appetizer", 1300),
    ("Finger fish", "Appetizer", 900),
    ("Sesame fried fish", "Appetizer", 600),
    ("Nuggets", "Appetizer", 450),
    ("Fried wings", "Appetizer", 500),
    ("Plain fries", "Appetizer", 300),
    # Steaks
    ("Special steak", "Steak", 1200),
    ("Italian steak", "Steak", 1200),
    ("Paper steak", "Steak", 1200),
    ("Bar-B-Q steak", "Steak", 1200),
    ("Delapaz steak (Mexican)", "Steak", 1200),
    # Bites & Platter
    ("Chicken shawarma", "Bites & Platter", 250),
    ("Shawarma platter", "Bites & Platter", 300),
    ("Mix platter (bread+Paratha)", "Bites & Platter", 350),
    ("Paratha platter", "Bites & Platter", 350),
    # Special Roll
    ("Kabab Roll", "Special Roll", 250),
    ("Chicken Paratha Roll", "Special Roll", 250),
    # Burgers
    ("Steak Malai burger", "Burgers", 450),
    ("Grilled burger", "Burgers", 450),
    ("Peti burger", "Burgers", 400),
    ("Zinger burger", "Burgers", 500),
    # Oven Pasta's
    ("Special Pasta F1", "Oven Pasta", 450),
    ("Special Pasta F2", "Oven Pasta", 800),
    ("Crunchy Pasta F1", "Oven Pasta", 500),
    ("Crunchy Pasta F2", "Oven Pasta", 900),
    ("Fettuccine Alfredo Pasta", "Oven Pasta", 600),
    # Ice Cream
    ("Mango", "Ice Cream", 300),
    ("Pista", "Ice Cream", 300),
    ("Kulfa", "Ice Cream", 300),
    ("Strawberry", "Ice Cream", 300),
    ("Caramel crunch", "Ice Cream", 300),
    ("Vanilla", "Ice Cream", 300),
    ("Chocolate chip", "Ice Cream", 300),
    # Dessert
    ("Molten lava with ice cream", "Dessert", 450),
    ("Night Dream (brownie with ice cream)", "Dessert", 500),
    ("Alaska sunshine", "Dessert", 550),
    ("Brownie", "Dessert", 280),
    ("Slice of cake", "Dessert", 280),
    # Starters
    ("Hot Wings", "Starters", 400),
    ("Chicken Spring Rolls", "Starters", 400),
    ("Special Platter", "Starters", 900)
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
