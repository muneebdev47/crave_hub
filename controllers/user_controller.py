from models.user_model import UserModel
from utils.validators import validate_not_empty


class UserController:

    @staticmethod
    def add_user(username, role):
        if not validate_not_empty(username):
            raise ValueError("Username cannot be empty")
        UserModel.create(username, role)

    @staticmethod
    def list_users():
        return UserModel.get_all()
