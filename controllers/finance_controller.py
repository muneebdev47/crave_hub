from datetime import datetime, date
from models.order_model import OrderModel


class FinanceController:

    @staticmethod
    def total_revenue():
        orders = OrderModel.get_all()
        return sum(order["total"] for order in orders)

    @staticmethod
    def total_orders_today():
        today_str = date.today().isoformat()
        orders = OrderModel.get_all()
        # assuming 'created_at' is ISO formatted string
        return len([o for o in orders if o["created_at"].startswith(today_str)])

    @staticmethod
    def revenue_today():
        today_str = date.today().isoformat()
        orders = OrderModel.get_all()
        return sum(o["total"] for o in orders if o["created_at"].startswith(today_str))

    @staticmethod
    def get_recent_orders(limit=20):
        orders = OrderModel.get_all()
        # sort by created_at descending
        orders_sorted = sorted(orders, key=lambda x: x["created_at"], reverse=True)
        return orders_sorted[:limit]
