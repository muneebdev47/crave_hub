from models.menu_model import MenuModel
from utils.validators import validate_not_empty, validate_price


class MenuController:

    @staticmethod
    def add_item(name, category, price):
        if not validate_not_empty(name):
            raise ValueError("Name required")
        if not validate_price(price):
            raise ValueError("Invalid price")
        MenuModel.create(name, category, float(price))

    @staticmethod
    def list_items():
        return MenuModel.get_all()
