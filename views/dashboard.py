from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QFrame,
    QListWidget,
)
from PyQt6.QtCharts import (
    QChart,
    QChartView,
    QLineSeries,
    QSplineSeries,
    QValueAxis,
    QCategoryAxis,
    QBarSeries, QBarSet, QBarCategoryAxis
)
from PyQt6.QtGui import QPainter
from PyQt6.QtCore import Qt


class DashboardView(QWidget):
    """
    Advanced Dashboard with KPIs, Charts & Alerts
    """

    def __init__(self):
        super().__init__()
        self._build_ui()

    # -------------------------------------------------
    def _build_ui(self):
        main_layout = QVBoxLayout()
        main_layout.setSpacing(18)

        # ================= KPIs =================
        kpi_layout = QHBoxLayout()
        kpi_layout.addWidget(self._kpi_card("Today's Orders", "18"))
        kpi_layout.addWidget(self._kpi_card("Monthly Orders", "342"))
        kpi_layout.addWidget(self._kpi_card("Today's Revenue", "Rs. 45,800"))
        kpi_layout.addWidget(self._kpi_card("Top Item", "Pepperoni Pizza"))

        # ================= Charts =================
        charts_layout = QHBoxLayout()
        charts_layout.addWidget(self._monthly_orders_chart())
        charts_layout.addWidget(self._peak_hours_chart())
        charts_layout.addWidget(self._employee_orders_chart())

        # ================= Bottom Panels =================
        bottom_layout = QHBoxLayout()
        bottom_layout.addWidget(self._recent_orders_panel())
        bottom_layout.addWidget(self._low_stock_panel())

        main_layout.addLayout(kpi_layout)
        main_layout.addLayout(charts_layout)
        main_layout.addLayout(bottom_layout)
        main_layout.addStretch()

        self.setLayout(main_layout)

    # -------------------------------------------------
    def _kpi_card(self, title, value):
        card = QFrame()
        card.setStyleSheet(
            """
            QFrame {
                background-color: #1E1E1E;
                border-radius: 12px;
                padding: 16px;
            }
        """
        )

        layout = QVBoxLayout()

        title_lbl = QLabel(title)
        title_lbl.setStyleSheet("color: #999; font-size: 13px;")

        value_lbl = QLabel(value)
        value_lbl.setStyleSheet("font-size: 22px; font-weight: bold;")

        layout.addWidget(title_lbl)
        layout.addWidget(value_lbl)

        card.setLayout(layout)
        return card

    # -------------------------------------------------
    def _monthly_orders_chart(self):
        series = QSplineSeries()
        series.setName("Orders")

        data = [120, 160, 190, 210, 260, 300]
        for i, value in enumerate(data):
            series.append(i, value)

        chart = QChart()
        chart.addSeries(series)
        chart.setTitle("Monthly Orders Trend")
        chart.legend().hide()
        chart.setAnimationOptions(QChart.AnimationOption.SeriesAnimations)

        axis_x = QCategoryAxis()
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
        for i, m in enumerate(months):
            axis_x.append(m, i)

        axis_y = QValueAxis()
        axis_y.setTitleText("Orders")

        chart.addAxis(axis_x, Qt.AlignmentFlag.AlignBottom)
        chart.addAxis(axis_y, Qt.AlignmentFlag.AlignLeft)
        series.attachAxis(axis_x)
        series.attachAxis(axis_y)

        chart_view = QChartView(chart)
        chart_view.setMinimumHeight(320)
        chart_view.setRenderHint(QPainter.RenderHint.Antialiasing)

        return chart_view


    # -------------------------------------------------
    def _peak_hours_chart(self):
        series = QSplineSeries()
        series.setName("Orders")

        hours = ["10–12", "12–2", "2–4", "6–8", "8–10"]
        orders = [30, 70, 120, 180, 140]

        for i, val in enumerate(orders):
            series.append(i, val)

        chart = QChart()
        chart.addSeries(series)
        chart.setTitle("Peak Order Hours")
        chart.legend().hide()
        chart.setAnimationOptions(QChart.AnimationOption.SeriesAnimations)

        axis_x = QCategoryAxis()
        for i, h in enumerate(hours):
            axis_x.append(h, i)

        axis_y = QValueAxis()
        axis_y.setTitleText("Orders")

        chart.addAxis(axis_x, Qt.AlignmentFlag.AlignBottom)
        chart.addAxis(axis_y, Qt.AlignmentFlag.AlignLeft)
        series.attachAxis(axis_x)
        series.attachAxis(axis_y)

        chart_view = QChartView(chart)
        chart_view.setMinimumHeight(320)
        chart_view.setRenderHint(QPainter.RenderHint.Antialiasing)

        return chart_view

    # -------------------------------------------------
    def _employee_orders_chart(self):
        series = QLineSeries()
        series.setName("Orders")

        employees = ["Ali", "Sara", "Ahmed", "Admin"]
        orders = [56, 42, 38, 61]

        for i, val in enumerate(orders):
            series.append(i, val)

        chart = QChart()
        chart.addSeries(series)
        chart.setTitle("Employee Performance")
        chart.legend().hide()
        chart.setAnimationOptions(QChart.AnimationOption.SeriesAnimations)

        axis_x = QCategoryAxis()
        for i, emp in enumerate(employees):
            axis_x.append(emp, i)

        axis_y = QValueAxis()
        axis_y.setTitleText("Orders")

        chart.addAxis(axis_x, Qt.AlignmentFlag.AlignBottom)
        chart.addAxis(axis_y, Qt.AlignmentFlag.AlignLeft)
        series.attachAxis(axis_x)
        series.attachAxis(axis_y)

        chart_view = QChartView(chart)
        chart_view.setMinimumHeight(320)
        chart_view.setRenderHint(QPainter.RenderHint.Antialiasing)

        return chart_view


    # -------------------------------------------------
    def _recent_orders_panel(self):
        frame = QFrame()
        frame.setStyleSheet(
            """
            QFrame {
                background-color: #1A1A1A;
                border-radius: 10px;
                padding: 10px;
            }
        """
        )

        layout = QVBoxLayout()
        title = QLabel("🧾 Recent Orders")
        title.setStyleSheet("font-weight: bold;")

        orders = QListWidget()
        orders.addItems(
            [
                "#1024 | Table 3 | Rs. 1850 | Admin",
                "#1025 | Walk-in | Rs. 900 | Sara",
                "#1026 | Table 1 | Rs. 2200 | Ali",
            ]
        )

        layout.addWidget(title)
        layout.addWidget(orders)
        frame.setLayout(layout)
        return frame

    # -------------------------------------------------
    def _low_stock_panel(self):
        frame = QFrame()
        frame.setStyleSheet(
            """
            QFrame {
                background-color: #2A1A1A;
                border-radius: 10px;
                padding: 10px;
            }
        """
        )

        layout = QVBoxLayout()
        title = QLabel("⚠ Low Stock Alerts")
        title.setStyleSheet("font-weight: bold; color: #ff5555;")

        alerts = QListWidget()
        alerts.addItems(
            [
                "Mozzarella Cheese (3 left)",
                "Coke Can (8 left)",
                "Chicken Tikka (5 left)",
            ]
        )

        layout.addWidget(title)
        layout.addWidget(alerts)
        frame.setLayout(layout)
        return frame
