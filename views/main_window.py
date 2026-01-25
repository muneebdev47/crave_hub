from PyQt6.QtWidgets import QMainWindow, QLabel
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebChannel import QWebChannel
from PyQt6.QtCore import QUrl
from PyQt6.QtGui import QIcon
from pathlib import Path
import sys
import os

from controllers.menu_backend import MenuBackend
from controllers.db_backend import DatabaseBackend


def resource_path(relative_path):
    """
    Get absolute path to resource, works for dev and PyInstaller.
    """
    try:
        # PyInstaller stores temp files in _MEIPASS
        base_path = Path(sys._MEIPASS)
    except AttributeError:
        # Normal dev environment
        base_path = Path(__file__).resolve().parent.parent
    return base_path / relative_path


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        # === WINDOW TITLE ===
        self.setWindowTitle("CraveHub Cafe")
        self.showMaximized()

        # === SET WINDOW ICON ===
        logo_path = resource_path("assets/logo.ico")  # Use .ico for Windows EXE
        if logo_path.exists():
            self.setWindowIcon(QIcon(str(logo_path)))

        # === STATUS BAR ===
        status_bar = self.statusBar()
        footer_label = QLabel("Developed by Muneeb 03256000110")
        footer_label.setStyleSheet("color: #888; padding: 5px;")
        status_bar.addPermanentWidget(footer_label)
        status_bar.setStyleSheet("background-color: #1A1A1A; color: #888;")

        # === WEB ENGINE VIEW ===
        self.web = QWebEngineView()
        self.setCentralWidget(self.web)

        # === WEB CHANNEL ===
        self.channel = QWebChannel()
        self.menu_backend = MenuBackend()
        self.db_backend = DatabaseBackend()
        self.channel.registerObject("menuBackend", self.menu_backend)
        self.channel.registerObject("dbBackend", self.db_backend)
        self.web.page().setWebChannel(self.channel)

        # === LOAD LOGIN PAGE ===
        html_file = resource_path("frontend/login.html")

        if not html_file.exists():
            raise FileNotFoundError(f"Login page not found: {html_file}")

        with open(html_file, "r", encoding="utf-8") as f:
            html_content = f.read()

        # Base URL must point to the folder containing HTML for relative assets
        base_url = QUrl.fromLocalFile(str(html_file.parent) + os.sep)
        self.web.setHtml(html_content, base_url)

        # === OPTIONAL: Load stylesheet if exists ===
        stylesheet_path = resource_path("assets/styles.qss")
        if stylesheet_path.exists():
            with open(stylesheet_path, "r", encoding="utf-8") as f:
                self.web.page().runJavaScript(
                    f"""
                    const style = document.createElement('style');
                    style.innerHTML = `{f.read()}`;
                    document.head.appendChild(style);
                    """
                )
