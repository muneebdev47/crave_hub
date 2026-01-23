from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QLabel,
    QFrame,
    QScrollArea,
    QGridLayout,
    QMessageBox,
)
from PyQt6.QtCore import Qt
from views.menu_item_dialog import MenuItemDialog


class MenuView(QWidget):
    """
    Menu Management Page (Elegant Card UI + CRUD)
    """

    def __init__(self):
        super().__init__()
        self.menu_items = self._load_menu_items()
        self.selected_id = None
        self.card_widgets = {}
        self._build_ui()

    # -------------------------------------------------
    def _build_ui(self):
        main_layout = QVBoxLayout()
        main_layout.setSpacing(15)

        # ================= TOP BAR =================
        top_bar = QHBoxLayout()

        create_btn = QPushButton("➕ Create Item")
        update_btn = QPushButton("✏ Update Item")
        delete_btn = QPushButton("❌ Delete Item")

        create_btn.clicked.connect(self._create_item)
        update_btn.clicked.connect(self._update_item)
        delete_btn.clicked.connect(self._delete_item)

        top_bar.addWidget(create_btn)
        top_bar.addWidget(update_btn)
        top_bar.addWidget(delete_btn)
        top_bar.addStretch()

        # ================= CARD GRID =================
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)

        container = QWidget()
        self.grid = QGridLayout()
        self.grid.setSpacing(18)

        container.setLayout(self.grid)
        scroll.setWidget(container)

        main_layout.addLayout(top_bar)
        main_layout.addWidget(scroll)

        self.setLayout(main_layout)
        self._populate_cards()

    # -------------------------------------------------
    def _load_menu_items(self):
        return [
            [1, "Pepperoni Pizza", 800, 1200, 1600],
            [2, "BBQ Chicken Pizza", 850, 1250, 1650],
            [3, "Fajita Pizza", 820, 1220, 1620],
            [4, "Veg Supreme", 750, 1150, 1550],
        ]

    # -------------------------------------------------
    def _populate_cards(self):
        self.card_widgets.clear()
        for i in reversed(range(self.grid.count())):
            self.grid.itemAt(i).widget().deleteLater()

        row = col = 0
        for item in self.menu_items:
            card = self._menu_card(item)
            self.card_widgets[item[0]] = card
            self.grid.addWidget(card, row, col)

            col += 1
            if col == 3:
                col = 0
                row += 1

    # -------------------------------------------------
    def _menu_card(self, item):
        item_id, name, s, m, l = item

        card = QFrame()
        card.setFixedWidth(260)
        card.setCursor(Qt.CursorShape.PointingHandCursor)

        def apply_style(selected=False):
            card.setStyleSheet(
                f"""
                QFrame {{
                    background-color: #1E1E1E;
                    border-radius: 14px;
                    padding: 14px;
                    border: {"2px solid #ff9800" if selected else "1px solid #2a2a2a"};
                }}
                QFrame:hover {{
                    border: 2px solid #ff9800;
                }}
            """
            )

        apply_style()

        card.mousePressEvent = lambda e: self._select_card(item_id)

        layout = QVBoxLayout()

        title = QLabel(name)
        title.setStyleSheet("font-size: 16px; font-weight: bold;")

        id_label = QLabel(f"ID: {item_id}")
        id_label.setStyleSheet("color: #888; font-size: 12px;")

        price_label = QLabel(f"Small: Rs {s}\n" f"Medium: Rs {m}\n" f"Large: Rs {l}")
        price_label.setStyleSheet("font-size: 13px;")

        layout.addWidget(title)
        layout.addWidget(id_label)
        layout.addSpacing(6)
        layout.addWidget(price_label)

        card.setLayout(layout)
        card._apply_style = apply_style
        return card

    # -------------------------------------------------
    def _select_card(self, item_id):
        self.selected_id = item_id
        for id_, card in self.card_widgets.items():
            card._apply_style(id_ == item_id)

    # -------------------------------------------------
    def _create_item(self):
        dialog = MenuItemDialog()
        if dialog.exec():
            data = dialog.get_data()
            if not data:
                return
            name, s, m, l = data
            new_id = max(i[0] for i in self.menu_items) + 1
            self.menu_items.append([new_id, name, s, m, l])
            self._populate_cards()

    # -------------------------------------------------
    def _update_item(self):
        if not self.selected_id:
            QMessageBox.warning(self, "Error", "Select a menu item to update")
            return

        item = next(i for i in self.menu_items if i[0] == self.selected_id)
        dialog = MenuItemDialog(item)

        if dialog.exec():
            data = dialog.get_data()
            if not data:
                return
            item[1], item[2], item[3], item[4] = data
            self._populate_cards()

    # -------------------------------------------------
    def _delete_item(self):
        if not self.selected_id:
            QMessageBox.warning(self, "Error", "Select a menu item to delete")
            return

        confirm = QMessageBox.question(
            self, "Confirm Delete", "Delete selected menu item?"
        )

        if confirm == QMessageBox.StandardButton.Yes:
            self.menu_items = [i for i in self.menu_items if i[0] != self.selected_id]
            self.selected_id = None
            self._populate_cards()
