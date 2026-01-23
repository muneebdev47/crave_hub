from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QMessageBox,
)
from PyQt6.QtCore import Qt


class LoginView(QWidget):
    """
    Login screen shown at app startup
    """

    # Temporary hardcoded admin user
    ADMIN_USERNAME = "admin"
    ADMIN_PASSWORD = "1234"

    def __init__(self, on_login_success):
        super().__init__()
        self.on_login_success = on_login_success
        self._build_ui()

    def _build_ui(self):
        self.setWindowTitle("Crave Hub - Login")
        self.resize(500, 400)

        layout = QVBoxLayout()
        layout.setSpacing(15)
        layout.setContentsMargins(150, 120, 150, 120)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        title = QLabel("🍕 Crave Hub")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setStyleSheet("font-size: 26px; font-weight: bold;")

        subtitle = QLabel("Login to continue")
        subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        subtitle.setStyleSheet("color: gray;")

        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("Username")

        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Password")
        self.password_input.setEchoMode(QLineEdit.EchoMode.Password)

        login_btn = QPushButton("Login")
        login_btn.clicked.connect(self.login)

        layout.addWidget(title)
        layout.addWidget(subtitle)
        layout.addSpacing(10)
        layout.addWidget(self.username_input)
        layout.addWidget(self.password_input)
        layout.addWidget(login_btn)

        self.setLayout(layout)

    def login(self):
        username = self.username_input.text().strip()
        password = self.password_input.text().strip()

        if not username or not password:
            QMessageBox.warning(self, "Error", "Username and password required")
            return

        if username == self.ADMIN_USERNAME and password == self.ADMIN_PASSWORD:
            self.on_login_success()
        else:
            QMessageBox.critical(self, "Login Failed", "Invalid credentials")
