from PyQt6.QtWidgets import QMainWindow, QLabel
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebChannel import QWebChannel
from PyQt6.QtCore import QUrl, Qt
from PyQt6.QtGui import QIcon, QPixmap
import os
from pathlib import Path

from controllers.menu_backend import MenuBackend
from controllers.db_backend import DatabaseBackend


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("CraveHub Cafe")
        self.setMinimumSize(1500, 1000)

        # Set window icon (logo)
        base_dir = Path(__file__).resolve().parent.parent
        logo_path = base_dir / "assets" / "logo.png"
        if logo_path.exists():
            self.setWindowIcon(QIcon(str(logo_path)))

        # Set up status bar with footer
        status_bar = self.statusBar()
        footer_label = QLabel("Developed by Muneeb 03256000110")
        footer_label.setStyleSheet("color: #888; padding: 5px;")
        status_bar.addPermanentWidget(footer_label)
        status_bar.setStyleSheet("background-color: #1A1A1A; color: #888;")

        self.web = QWebEngineView()
        self.setCentralWidget(self.web)

        # Set up WebChannel for JavaScript-Python communication
        self.channel = QWebChannel()
        self.menu_backend = MenuBackend()
        self.db_backend = DatabaseBackend()

        # Register backend objects
        self.channel.registerObject("menuBackend", self.menu_backend)
        self.channel.registerObject("dbBackend", self.db_backend)

        # Set WebChannel on the page
        self.web.page().setWebChannel(self.channel)

        # Load login page by default
        html_path = os.path.abspath("frontend/login.html")

        # Read the HTML content
        with open(html_path, "r", encoding="utf-8") as f:
            html_content = f.read()

        # Base URL points to the folder containing the HTML file
        base_url = QUrl.fromLocalFile(os.path.dirname(html_path) + os.sep)

        # Load HTML content with base URL
        self.web.setHtml(html_content, base_url)
