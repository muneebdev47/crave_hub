import sys
from PyQt6.QtWidgets import QApplication
from pathlib import Path

from views.main_window import MainWindow

BASE_DIR = Path(__file__).resolve().parent

app = QApplication(sys.argv)

# Load styles
with open(BASE_DIR / "assets" / "styles.qss", "r") as f:
    app.setStyleSheet(f.read())

# Create and show main window (loads login.html by default)
main_window = MainWindow()
main_window.show()

sys.exit(app.exec())
