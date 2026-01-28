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

MENU_ITEMS = [
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
("Grilled Cheese Sandwich", "Sandwiches", 600),
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
("Special Platter", "Starters", 900),
# Deals
("Deal 1", "Deals", 399),
("Deal 2", "Deals", 750),
("Deal 3", "Deals", 2699),
("Deal 4", "Deals", 2499),
("Deal 5", "Deals", 1450),
("Deal 6", "Deals", 799),
("Deal 7", "Deals", 1150),
("Deal 8", "Deals", 1350)
]
def get_connection():
    """
    Returns a SQLite connection and ensures schema is initialized.
    Database is stored next to the executable in production, or in project root in development.
    """
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    _initialize_db(conn)
    return conn


def _seed_menu_items(conn):
    """
    Seeds menu items into the database if they don't already exist.
    This is called automatically during database initialization.
    Adds any missing items from MENU_ITEMS to the database.
    """
    cursor = conn.cursor()

    # Get existing menu item names for quick lookup
    cursor.execute("SELECT name FROM menu_items")
    existing_names = {row[0] for row in cursor.fetchall()}

    # Insert menu items that don't exist
    inserted_count = 0
    for name, category, price in MENU_ITEMS:
        if name not in existing_names:
            try:
                cursor.execute(
                    "INSERT INTO menu_items (name, category, price, is_available) VALUES (?, ?, ?, 1)",
                    (name, category, price),
                )
                inserted_count += 1
            except sqlite3.IntegrityError:
                # Item already exists (shouldn't happen, but handle gracefully)
                pass

    if inserted_count > 0:
        conn.commit()


def _initialize_db(conn):
    """
    Creates tables if they do not exist and seeds initial menu items.
    Runs only once per database.
    """
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='users';
    """
    )

    db_initialized = cursor.fetchone() is not None

    if not db_initialized:
        # First time initialization - create tables
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()

        # Seed menu items after schema is created
        _seed_menu_items(conn)
    else:
        # Database exists, but check if menu items need seeding
        # (in case schema was created manually without menu items)
        _seed_menu_items(conn)
        
        # Add discount_percentage column if it doesn't exist (migration)
        try:
            cursor.execute("ALTER TABLE orders ADD COLUMN discount_percentage REAL DEFAULT 0")
            conn.commit()
        except sqlite3.OperationalError:
            # Column already exists, ignore
            pass
        
        # Add customer_address column if it doesn't exist (migration)
        try:
            cursor.execute("ALTER TABLE orders ADD COLUMN customer_address TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            # Column already exists, ignore
            pass
        
        # Add order_note column if it doesn't exist (migration)
        try:
            cursor.execute("ALTER TABLE orders ADD COLUMN order_note TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            # Column already exists, ignore
            pass
