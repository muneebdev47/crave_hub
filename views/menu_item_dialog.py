from PyQt6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QMessageBox,
)


class MenuItemDialog(QDialog):
    """
    Dialog for creating/updating menu items
    """

    def __init__(self, item=None):
        super().__init__()
        self.item = item
        self.setWindowTitle("Menu Item")
        self._build_ui()

    def _build_ui(self):
        layout = QVBoxLayout()

        self.name_input = QLineEdit()
        self.small_input = QLineEdit()
        self.medium_input = QLineEdit()
        self.large_input = QLineEdit()

        self.name_input.setPlaceholderText("Item Name")
        self.small_input.setPlaceholderText("Small Price")
        self.medium_input.setPlaceholderText("Medium Price")
        self.large_input.setPlaceholderText("Large Price")

        if self.item:
            self.name_input.setText(self.item[1])
            self.small_input.setText(str(self.item[2]))
            self.medium_input.setText(str(self.item[3]))
            self.large_input.setText(str(self.item[4]))

        save_btn = QPushButton("Save")
        save_btn.clicked.connect(self.accept)

        layout.addWidget(QLabel("Name"))
        layout.addWidget(self.name_input)
        layout.addWidget(QLabel("Small Price"))
        layout.addWidget(self.small_input)
        layout.addWidget(QLabel("Medium Price"))
        layout.addWidget(self.medium_input)
        layout.addWidget(QLabel("Large Price"))
        layout.addWidget(self.large_input)
        layout.addWidget(save_btn)

        self.setLayout(layout)

    def get_data(self):
        try:
            return (
                self.name_input.text(),
                int(self.small_input.text() or 0),
                int(self.medium_input.text() or 0),
                int(self.large_input.text() or 0),
            )
        except ValueError:
            QMessageBox.warning(self, "Error", "Prices must be numbers")
            return None
