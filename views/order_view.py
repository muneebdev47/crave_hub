from PyQt6.QtWidgets import (
    QWidget,
    QPushButton,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QTableWidget,
    QTableWidgetItem,
    QAbstractItemView,
    QStackedLayout,
    QDialog,
    QTextEdit,
)
from PyQt6.QtPrintSupport import QPrinter, QPrintDialog
from PyQt6.QtCore import Qt
from controllers.order_controller import OrderController

MENU_ITEMS = [
    {"name": "Margherita Pizza", "price": 10.0},
    {"name": "Pepperoni Pizza", "price": 12.0},
    {"name": "Veggie Pizza", "price": 11.0},
    {"name": "Coke", "price": 2.0},
    {"name": "Garlic Bread", "price": 4.0},
]


class ReceiptDialog(QDialog):
    """Dialog to show final receipt, print, and confirm order"""

    def __init__(self, order_type, order_details, order_items, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Confirm Order")
        self.setFixedSize(400, 500)

        self.order_type = order_type
        self.order_details = order_details
        self.order_items = order_items

        layout = QVBoxLayout()
        self.setLayout(layout)

        self.text_edit = QTextEdit()
        self.text_edit.setReadOnly(True)
        layout.addWidget(self.text_edit)

        self.generate_receipt_text()
        # Buttons
        btn_layout = QHBoxLayout()
        layout.addLayout(btn_layout)

        self.print_btn = QPushButton("Print & Confirm")
        self.print_btn.clicked.connect(self.print_and_confirm)
        btn_layout.addWidget(self.print_btn)

        self.print_more_btn = QPushButton("Print More Copies")
        self.print_more_btn.clicked.connect(self.print_more_copies)
        btn_layout.addWidget(self.print_more_btn)

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(self.cancel_btn)

    def generate_receipt_text(self):
        receipt_text = f"*** Crave Hub Pizza Restaurant ***\n\nOrder Type: {self.order_type}\n"
        if self.order_type == "Table Order":
            receipt_text += f"Table #: {self.order_details.get('table_number')}\n"
        if self.order_type in ["Take-away", "Online Order"]:
            receipt_text += f"Customer: {self.order_details.get('customer_name')}\n"
        if self.order_type == "Online Order":
            receipt_text += f"Phone: {self.order_details.get('customer_phone')}\n"

        receipt_text += "\nItems:\n"
        receipt_text += "{:<30} {:<5} {:<8}\n".format("Item", "Qty", "Price")
        receipt_text += "-" * 35 + "\n"
        self.total = 0
        for item in self.order_items:
            name = item["name"]
            qty = item["quantity"]
            price = item["price"]
            subtotal = qty * price
            self.total += subtotal
            receipt_text += "{:<30} {:<5} ${:<.2f}\n".format(name, qty, subtotal)
        receipt_text += "\nTotal: ${:.2f}".format(self.total)
        self.text_edit.setText(receipt_text)

    def print_receipt(self):
        printer = QPrinter()
        dialog = QPrintDialog(printer, self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self.text_edit.print(printer)

    def print_and_confirm(self):
        try:
            self.print_receipt()
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Printing failed: {e}")
            return
        self.accept()  # closes dialog and confirms order

    def print_more_copies(self):
        try:
            self.print_receipt()
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Printing failed: {e}")


# ---------------- Order View ----------------


class OrderView(QWidget):

    def __init__(self, dashboard_callback=None):
        super().__init__()
        self.dashboard_callback = dashboard_callback
        self.order_type = None
        self.order_details = {}
        self.order_items = {}

        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout()
        self.setLayout(layout)
        self.stack = QStackedLayout()
        layout.addLayout(self.stack)

        # Step 1 screen
        self.screen_select_order_type = QWidget()
        self.stack.addWidget(self.screen_select_order_type)
        self.init_order_type_screen()

        # Step 2 screen
        self.screen_place_order = QWidget()
        self.stack.addWidget(self.screen_place_order)
        self.init_place_order_screen()

        self.stack.setCurrentWidget(self.screen_select_order_type)

    def init_order_type_screen(self):
        layout = QVBoxLayout()
        self.screen_select_order_type.setLayout(layout)
        layout.addWidget(
            QLabel("Select Order Type", alignment=Qt.AlignmentFlag.AlignCenter)
        )
        btn_layout = QHBoxLayout()
        layout.addLayout(btn_layout)

        self.btn_table_order = QPushButton("Table Order")
        self.btn_takeaway = QPushButton("Take-away")
        self.btn_online_order = QPushButton("Online Order")
        for btn in [self.btn_table_order, self.btn_takeaway, self.btn_online_order]:
            btn.setFixedSize(150, 80)
            btn_layout.addWidget(btn)

        self.btn_table_order.clicked.connect(
            lambda: self.go_to_order_screen("Table Order")
        )
        self.btn_takeaway.clicked.connect(lambda: self.go_to_order_screen("Take-away"))
        self.btn_online_order.clicked.connect(
            lambda: self.go_to_order_screen("Online Order")
        )

    def go_to_order_screen(self, order_type):
        self.order_type = order_type
        self.order_items = {}
        self.order_details = {}
        # show/hide fields
        self.table_input.setVisible(order_type == "Table Order")
        self.customer_name_input.setVisible(order_type in ["Take-away", "Online Order"])
        self.customer_phone_input.setVisible(order_type == "Online Order")
        self.update_selected_items()
        self.search_input.clear()
        self.stack.setCurrentWidget(self.screen_place_order)

    def init_place_order_screen(self):
        layout = QVBoxLayout()
        self.screen_place_order.setLayout(layout)
        back_btn = QPushButton("Back")
        back_btn.clicked.connect(
            lambda: self.stack.setCurrentWidget(self.screen_select_order_type)
        )
        layout.addWidget(back_btn, alignment=Qt.AlignmentFlag.AlignLeft)

        # form
        form_layout = QVBoxLayout()
        layout.addLayout(form_layout)
        self.table_input = QLineEdit()
        self.table_input.setPlaceholderText("Table Number")
        form_layout.addWidget(self.table_input)
        self.customer_name_input = QLineEdit()
        self.customer_name_input.setPlaceholderText("Customer Name")
        form_layout.addWidget(self.customer_name_input)
        self.customer_phone_input = QLineEdit()
        self.customer_phone_input.setPlaceholderText("Customer Phone")
        form_layout.addWidget(self.customer_phone_input)

        # menu
        menu_layout = QHBoxLayout()
        layout.addLayout(menu_layout)
        left = QVBoxLayout()
        menu_layout.addLayout(left)
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search menu...")
        self.search_input.textChanged.connect(self.filter_menu)
        left.addWidget(self.search_input)
        self.menu_list = QListWidget()
        self.menu_list.setFixedWidth(250)
        self.menu_list.itemDoubleClicked.connect(self.add_item_to_order)
        left.addWidget(self.menu_list)
        right = QVBoxLayout()
        menu_layout.addLayout(right)
        self.selected_table = QTableWidget()
        self.selected_table.setColumnCount(2)
        self.selected_table.setHorizontalHeaderLabels(["Item", "Quantity"])
        self.selected_table.setSelectionBehavior(
            QAbstractItemView.SelectionBehavior.SelectRows
        )
        right.addWidget(QLabel("Selected Items:"))
        right.addWidget(self.selected_table)
        remove_btn = QPushButton("Remove Selected Item")
        remove_btn.clicked.connect(self.remove_selected_item)
        right.addWidget(remove_btn)
        self.total_label = QLabel("Total: $0.00")
        right.addWidget(self.total_label)
        place_btn = QPushButton("Place Order")
        place_btn.clicked.connect(self.show_receipt)
        right.addWidget(place_btn)

        self.load_menu_items()

    def load_menu_items(self):
        self.menu_list.clear()
        for item in MENU_ITEMS:
            self.menu_list.addItem(f"{item['name']} - ${item['price']}")

    def filter_menu(self):
        text = self.search_input.text().lower()
        self.menu_list.clear()
        for item in MENU_ITEMS:
            if text in item["name"].lower():
                self.menu_list.addItem(f"{item['name']} - ${item['price']}")

    def add_item_to_order(self, item):
        name = item.text().split(" - $")[0]
        menu_item = next(x for x in MENU_ITEMS if x["name"] == name)
        if name in self.order_items:
            self.order_items[name]["quantity"] += 1
        else:
            self.order_items[name] = {"price": menu_item["price"], "quantity": 1}
        self.update_selected_items()

    def update_selected_items(self):
        self.selected_table.setRowCount(0)
        total = 0
        for row, (name, data) in enumerate(self.order_items.items()):
            self.selected_table.insertRow(row)
            self.selected_table.setItem(row, 0, QTableWidgetItem(name))
            self.selected_table.setItem(row, 1, QTableWidgetItem(str(data["quantity"])))
            total += data["quantity"] * data["price"]
        self.total_label.setText(f"Total: ${total:.2f}")

    def remove_selected_item(self):
        rows = self.selected_table.selectionModel().selectedRows()
        for r in rows:
            name = self.selected_table.item(r.row(), 0).text()
            if name in self.order_items:
                del self.order_items[name]
        self.update_selected_items()

    def show_receipt(self):
        if not self.order_items:
            QMessageBox.warning(self, "Error", "No items selected")
            return
        if self.order_type == "Table Order" and not self.table_input.text().strip():
            QMessageBox.warning(self, "Error", "Enter table number")
            return
        if (
            self.order_type in ["Take-away", "Online Order"]
            and not self.customer_name_input.text().strip()
        ):
            QMessageBox.warning(self, "Error", "Enter customer name")
            return
        if (
            self.order_type == "Online Order"
            and not self.customer_phone_input.text().strip()
        ):
            QMessageBox.warning(self, "Error", "Enter customer phone")
            return

        if self.order_type == "Table Order":
            self.order_details["table_number"] = self.table_input.text().strip()
        if self.order_type in ["Take-away", "Online Order"]:
            self.order_details["customer_name"] = (
                self.customer_name_input.text().strip()
            )
        if self.order_type == "Online Order":
            self.order_details["customer_phone"] = (
                self.customer_phone_input.text().strip()
            )

        items_list = [
            {"name": n, "price": d["price"], "quantity": d["quantity"]}
            for n, d in self.order_items.items()
        ]

        receipt_dialog = ReceiptDialog(
            self.order_type, self.order_details, items_list, self
        )
        result = receipt_dialog.exec()
        if result == QDialog.DialogCode.Accepted:
            OrderController.create_order(
                order_type=self.order_type,
                order_items=items_list,
                order_details=self.order_details,
            )
            QMessageBox.information(self, "Success", "Order placed successfully!")
            if self.dashboard_callback:
                self.dashboard_callback()
