"""
Database Seeding Script
Populates the database with:
- 4 users (admin, manager, staff, cashier)
- All menu items
- 10 orders with order items
"""
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
import random

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "cravehub.db"

# Menu items data
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

# Users data
users = [
    ("admin", "Admin", "admin123", 1),
    ("manager", "Manager", "manager123", 1),
    ("staff", "Staff", "staff123", 1),
    ("cashier", "Cashier", "cashier123", 1),
]

# Order types
order_types = ["Table", "Takeaway", "Delivery"]

def clear_database(conn):
    """Clear existing data (optional - comment out if you want to keep existing data)"""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM order_items")
    cursor.execute("DELETE FROM orders")
    cursor.execute("DELETE FROM menu_items")
    cursor.execute("DELETE FROM users")
    conn.commit()
    print("Database cleared.")

def seed_users(conn):
    """Add users to database"""
    cursor = conn.cursor()
    for username, role, password, is_active in users:
        try:
            cursor.execute(
                "INSERT INTO users (username, role, password, is_active) VALUES (?, ?, ?, ?)",
                (username, role, password, is_active),
            )
            print(f"✓ Added user: {username} ({role})")
        except sqlite3.IntegrityError:
            print(f"⚠ User {username} already exists, skipping...")
    conn.commit()

def seed_menu_items(conn):
    """Add menu items to database"""
    cursor = conn.cursor()
    for name, category, price in menu_items:
        try:
            cursor.execute(
                "INSERT INTO menu_items (name, category, price, is_available) VALUES (?, ?, ?, 1)",
                (name, category, price),
            )
            print(f"✓ Added menu item: {name}")
        except sqlite3.IntegrityError:
            print(f"⚠ Menu item {name} already exists, skipping...")
    conn.commit()

def seed_orders(conn):
    """Create 10 orders with order items"""
    cursor = conn.cursor()
    
    # Get all menu item IDs
    cursor.execute("SELECT id, price FROM menu_items")
    menu_items_data = cursor.fetchall()
    
    if not menu_items_data:
        print("⚠ No menu items found. Please seed menu items first.")
        return
    
    # Create 10 orders with dates spread over the last 7 days
    base_date = datetime.now()
    
    for order_num in range(1, 11):
        # Random order type
        order_type = random.choice(order_types)
        
        # Random date within last 7 days
        days_ago = random.randint(0, 6)
        hours_ago = random.randint(0, 23)
        minutes_ago = random.randint(0, 59)
        order_date = base_date - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
        
        # Create order with 1-4 random items
        num_items = random.randint(1, 4)
        selected_items = random.sample(menu_items_data, min(num_items, len(menu_items_data)))
        
        # Calculate total
        total = sum(item[1] * random.randint(1, 3) for item in selected_items)
        
        # Insert order
        cursor.execute(
            "INSERT INTO orders (order_type, total, created_at) VALUES (?, ?, ?)",
            (order_type, total, order_date.isoformat()),
        )
        order_id = cursor.lastrowid
        
        # Insert order items
        for menu_item_id, price in selected_items:
            quantity = random.randint(1, 3)
            cursor.execute(
                "INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)",
                (order_id, menu_item_id, quantity, price),
            )
        
        print(f"✓ Created order #{order_id}: {order_type} - Rs. {total:.2f} ({order_date.strftime('%Y-%m-%d %H:%M')})")
    
    conn.commit()

def update_schema(conn):
    """Update database schema if needed"""
    cursor = conn.cursor()
    
    # Check if password column exists
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'password' not in columns:
        print("Adding password column to users table...")
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT ''")
            conn.commit()
            print("✓ Password column added.")
        except sqlite3.OperationalError as e:
            print(f"⚠ Could not add password column: {e}")

def main():
    """Main seeding function"""
    print("=" * 60)
    print("Database Seeding Script")
    print("=" * 60)
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    
    try:
        # Update schema if needed
        print("\n0. Checking database schema...")
        update_schema(conn)
        
        # Uncomment the line below if you want to clear existing data
        # clear_database(conn)
        
        print("\n1. Seeding users...")
        seed_users(conn)
        
        print("\n2. Seeding menu items...")
        seed_menu_items(conn)
        
        print("\n3. Seeding orders...")
        seed_orders(conn)
        
        print("\n" + "=" * 60)
        print("✓ Database seeding completed successfully!")
        print("=" * 60)
        
        # Print summary
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM menu_items")
        menu_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM orders")
        order_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM order_items")
        order_item_count = cursor.fetchone()[0]
        
        print(f"\nSummary:")
        print(f"  - Users: {user_count}")
        print(f"  - Menu Items: {menu_count}")
        print(f"  - Orders: {order_count}")
        print(f"  - Order Items: {order_item_count}")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()
