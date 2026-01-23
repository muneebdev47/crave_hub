from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QLabel,
    QHBoxLayout,
    QTableWidget,
    QTableWidgetItem,
)
from controllers.finance_controller import FinanceController


class FinanceView(QWidget):

    def __init__(self):
        super().__init__()
        layout = QVBoxLayout()
        self.setLayout(layout)

        # Top metrics
        metrics_layout = QHBoxLayout()
        layout.addLayout(metrics_layout)

        orders_today = FinanceController.total_orders_today()
        revenue_today = FinanceController.revenue_today()
        total_revenue = FinanceController.total_revenue()

        metrics_layout.addWidget(QLabel(f"Today's Orders: {orders_today}"))
        metrics_layout.addWidget(QLabel(f"Today's Revenue: ${revenue_today:.2f}"))
        metrics_layout.addWidget(QLabel(f"Total Revenue: ${total_revenue:.2f}"))

        # Order history table
        self.table = QTableWidget()
        layout.addWidget(self.table)

        recent_orders = FinanceController.get_recent_orders()
        self.table.setColumnCount(6)
        self.table.setHorizontalHeaderLabels(
            ["Order ID", "Time", "Type", "Customer/Table", "Total", "Status"]
        )
        self.table.setRowCount(len(recent_orders))

        for row, order in enumerate(recent_orders):
            self.table.setItem(row, 0, QTableWidgetItem(str(order["id"])))
            self.table.setItem(row, 1, QTableWidgetItem(str(order["created_at"])))
            self.table.setItem(row, 2, QTableWidgetItem(order["order_type"]))
            # show customer_name if exists else table_number (you might need to add these columns)
            self.table.setItem(
                row,
                3,
                QTableWidgetItem(
                    str(order.get("customer_name", order.get("table_number", "")))
                ),
            )
            self.table.setItem(row, 4, QTableWidgetItem(f"${order['total']:.2f}"))
            self.table.setItem(row, 5, QTableWidgetItem("Completed"))
