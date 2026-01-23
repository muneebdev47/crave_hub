from models.order_model import OrderModel


class OrderController:

    @staticmethod
    def create_order(order_type, total):
        OrderModel.create(order_type, total)

    @staticmethod
    def list_orders():
        return OrderModel.get_all()
