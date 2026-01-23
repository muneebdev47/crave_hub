import sys
from PyQt6.QtWidgets import QApplication
from pathlib import Path

from views.login_view import LoginView
from views.main_window import MainWindow

BASE_DIR = Path(__file__).resolve().parent

app = QApplication(sys.argv)

# Load styles
with open(BASE_DIR / "assets" / "styles.qss", "r") as f:
    app.setStyleSheet(f.read())

main_window = MainWindow()


def show_main():
    main_window.show()
    login.close()


login = LoginView(on_login_success=show_main)
login.show()

sys.exit(app.exec())
