from PyQt6.QtWidgets import (
    QMainWindow,
    QWidget,
    QHBoxLayout,
    QVBoxLayout,
    QPushButton,
    QStackedWidget,
    QLabel,
)
from PyQt6.QtGui import QIcon
from pathlib import Path

from views.dashboard import DashboardView
from views.user_view import UserView
from views.menu_view import MenuView
from views.order_view import OrderView
from views.finance_view import FinanceView


class MainWindow(QMainWindow):
    """
    Main application window with left navbar
    """

    def __init__(self):
        super().__init__()

        BASE_DIR = Path(__file__).resolve().parent.parent
        self.setWindowTitle("Crave Hub")
        self.resize(1200, 800)
        self.setWindowIcon(QIcon(str(BASE_DIR / "assets" / "logo.png")))

        self._build_ui()

    def _build_ui(self):
        root = QWidget()
        root_layout = QHBoxLayout()
        root_layout.setContentsMargins(0, 0, 0, 0)

        # -------- Sidebar --------
        sidebar = QWidget()
        sidebar.setObjectName("Sidebar")
        sidebar_layout = QVBoxLayout()
        sidebar_layout.setSpacing(10)

        title = QLabel("🍕 Crave Hub")
        title.setStyleSheet("font-size: 20px; font-weight: bold;")

        btn_dashboard = self._nav_button("Dashboard", 0)
        btn_users = self._nav_button("Users", 1)
        btn_menu = self._nav_button("Menu", 2)
        btn_orders = self._nav_button("Orders", 3)
        btn_finance = self._nav_button("Finance", 4)

        sidebar_layout.addWidget(title)
        sidebar_layout.addWidget(btn_dashboard)
        sidebar_layout.addWidget(btn_users)
        sidebar_layout.addWidget(btn_menu)
        sidebar_layout.addWidget(btn_orders)
        sidebar_layout.addWidget(btn_finance)
        sidebar_layout.addStretch()

        sidebar.setLayout(sidebar_layout)
        sidebar.setFixedWidth(200)

        # -------- Pages --------
        self.pages = QStackedWidget()
        self.pages.addWidget(DashboardView())
        self.pages.addWidget(UserView())
        self.pages.addWidget(MenuView())
        self.pages.addWidget(OrderView())
        self.pages.addWidget(FinanceView())

        root_layout.addWidget(sidebar)
        root_layout.addWidget(self.pages)

        root.setLayout(root_layout)
        self.setCentralWidget(root)

    def _nav_button(self, text, index):
        btn = QPushButton(text)
        btn.setObjectName("NavButton")
        btn.clicked.connect(lambda: self.pages.setCurrentIndex(index))
        return btn
