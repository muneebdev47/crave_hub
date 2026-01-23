from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QTableWidget,
    QTableWidgetItem,
    QPushButton,
    QLineEdit,
    QMessageBox,
)
from PyQt6.QtCore import Qt


class UserView(QWidget):
    """
    User Management Page
    """

    def __init__(self):
        super().__init__()
        self.users = self._load_users()
        self._build_ui()

    # -------------------------------------------------
    def _build_ui(self):
        main_layout = QVBoxLayout()
        main_layout.setSpacing(15)

        # ================= TOP BAR =================
        top_bar = QHBoxLayout()

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search user...")
        self.search_input.textChanged.connect(self._filter_users)

        add_btn = QPushButton("➕ Add User")
        update_btn = QPushButton("✏ Update User")
        delete_btn = QPushButton("❌ Delete User")

        add_btn.clicked.connect(self._add_user)
        update_btn.clicked.connect(self._update_user)
        delete_btn.clicked.connect(self._delete_user)

        top_bar.addWidget(self.search_input)
        top_bar.addStretch()
        top_bar.addWidget(add_btn)
        top_bar.addWidget(update_btn)
        top_bar.addWidget(delete_btn)

        # ================= TABLE =================
        self.table = QTableWidget()
        self.table.setColumnCount(4)
        self.table.setHorizontalHeaderLabels(["ID", "Username", "Role", "Status"])
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)

        self._populate_table(self.users)

        main_layout.addLayout(top_bar)
        main_layout.addWidget(self.table)

        self.setLayout(main_layout)

    # -------------------------------------------------
    def _load_users(self):
        """
        Placeholder data.
        Replace later with DB query.
        """
        return [
            (1, "admin", "Admin", "Active"),
            (2, "ali", "Staff", "Active"),
            (3, "sara", "Staff", "Inactive"),
            (4, "ahmed", "Staff", "Active"),
        ]

    # -------------------------------------------------
    def _populate_table(self, users):
        self.table.setRowCount(0)
        for row_data in users:
            row = self.table.rowCount()
            self.table.insertRow(row)
            for col, value in enumerate(row_data):
                self.table.setItem(row, col, QTableWidgetItem(str(value)))

        self.table.resizeColumnsToContents()

    # -------------------------------------------------
    def _filter_users(self):
        keyword = self.search_input.text().lower()
        filtered = [user for user in self.users if keyword in user[1].lower()]
        self._populate_table(filtered)

    # -------------------------------------------------
    def _get_selected_user(self):
        selected = self.table.selectedItems()
        if not selected:
            return None
        row = selected[0].row()
        return (
            self.table.item(row, 0).text(),
            self.table.item(row, 1).text(),
            self.table.item(row, 2).text(),
            self.table.item(row, 3).text(),
        )

    # -------------------------------------------------
    def _add_user(self):
        QMessageBox.information(
            self, "Add User", "Add User dialog will be implemented here"
        )

    # -------------------------------------------------
    def _update_user(self):
        user = self._get_selected_user()
        if not user:
            QMessageBox.warning(self, "Error", "Select a user to update")
            return

        QMessageBox.information(self, "Update User", f"Update User: {user[1]}")

    # -------------------------------------------------
    def _delete_user(self):
        user = self._get_selected_user()
        if not user:
            QMessageBox.warning(self, "Error", "Select a user to delete")
            return

        confirm = QMessageBox.question(
            self,
            "Confirm Delete",
            f"Delete user '{user[1]}'?",
        )

        if confirm == QMessageBox.StandardButton.Yes:
            QMessageBox.information(self, "Deleted", "User deleted successfully")
