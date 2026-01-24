let dbBackend = null;
let revenueByTypeChart = null;
let ordersByStatusChart = null;
let dailyRevenueChart = null;
let dailyOrdersChart = null;
let currentDateFrom = null;
let currentDateTo = null;

// Helper function to safely execute database queries
async function safeDbQuery(sql, params = null) {
    if (!dbBackend) {
        console.error("Database backend not initialized");
        return [];
    }

    try {
        let response;

        if (params && Array.isArray(params) && params.length > 0) {
            const paramsJson = JSON.stringify(params);
            response = dbBackend.execute_with_params(sql, paramsJson);
        } else {
            response = dbBackend.execute_query(sql);
        }

        if (response && typeof response.then === 'function') {
            response = await response;
        }

        if (typeof response !== 'string') {
            console.error("Invalid response type from database:", typeof response, response);
            return [];
        }

        const result = JSON.parse(response || "[]");
        return Array.isArray(result) ? result : [];
    } catch (error) {
        console.error("Error executing database query:", error, sql);
        return [];
    }
}

// Initialize Qt WebChannel
function initWebChannel() {
    if (typeof QWebChannel === 'undefined') {
        setTimeout(initWebChannel, 100);
        return;
    }

    if (typeof qt !== 'undefined' && qt.webChannelTransport) {
        try {
            new QWebChannel(qt.webChannelTransport, function (channel) {
                window.dbBackend = channel.objects.dbBackend;
                dbBackend = channel.objects.dbBackend;
                // Set default date range to current month
                const today = new Date();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                document.getElementById("dateFrom").value = firstDay.toISOString().split('T')[0];
                document.getElementById("dateTo").value = today.toISOString().split('T')[0];
                loadFinanceData();
            });
        } catch (error) {
            console.error("Error initializing WebChannel:", error);
        }
    } else {
        console.warn("Qt WebChannel not available.");
    }
}

// Load finance data with date filter
async function loadFinanceData() {
    if (!dbBackend) {
        console.error("Database backend not initialized");
        setTimeout(loadFinanceData, 500);
        return;
    }

    try {
        const dateFrom = document.getElementById("dateFrom").value || null;
        const dateTo = document.getElementById("dateTo").value || null;
        
        currentDateFrom = dateFrom;
        currentDateTo = dateTo;

        // Build date filter SQL
        let dateFilter = "";
        if (dateFrom && dateTo) {
            dateFilter = `AND date(created_at) >= '${dateFrom}' AND date(created_at) <= '${dateTo}'`;
        } else if (dateFrom) {
            dateFilter = `AND date(created_at) >= '${dateFrom}'`;
        } else if (dateTo) {
            dateFilter = `AND date(created_at) <= '${dateTo}'`;
        }

        // Total Orders
        const totalOrdersSql = `SELECT COUNT(*) as count FROM orders WHERE 1=1 ${dateFilter}`;
        const totalOrdersData = await safeDbQuery(totalOrdersSql);

        // Total Revenue
        const totalRevenueSql = `SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE 1=1 ${dateFilter}`;
        const totalRevenueData = await safeDbQuery(totalRevenueSql);

        // Completed Orders
        const completedOrdersSql = `SELECT COUNT(*) as count FROM orders WHERE order_status = 'completed' ${dateFilter}`;
        const completedOrdersData = await safeDbQuery(completedOrdersSql);

        // Pending Orders
        const pendingOrdersSql = `SELECT COUNT(*) as count FROM orders WHERE order_status = 'pending' OR order_status IS NULL ${dateFilter}`;
        const pendingOrdersData = await safeDbQuery(pendingOrdersSql);

        // Average Order Value
        const avgOrderSql = `SELECT COALESCE(AVG(total), 0) as avg_value FROM orders WHERE 1=1 ${dateFilter}`;
        const avgOrderData = await safeDbQuery(avgOrderSql);

        // Total Payments
        const paymentsSql = `
            SELECT COALESCE(SUM(pt.amount), 0) as total_payments
            FROM payment_transactions pt
            JOIN orders o ON pt.order_id = o.id
            WHERE 1=1 ${dateFilter}
        `;
        const paymentsData = await safeDbQuery(paymentsSql);

        // Update statistics
        document.getElementById("total-orders").innerText = totalOrdersData[0]?.count || 0;
        document.getElementById("total-revenue").innerText = `Rs. ${parseFloat(totalRevenueData[0]?.revenue || 0).toFixed(2)}`;
        document.getElementById("completed-orders").innerText = completedOrdersData[0]?.count || 0;
        document.getElementById("pending-orders").innerText = pendingOrdersData[0]?.count || 0;
        document.getElementById("avg-order-value").innerText = `Rs. ${parseFloat(avgOrderData[0]?.avg_value || 0).toFixed(2)}`;
        document.getElementById("total-payments").innerText = `Rs. ${parseFloat(paymentsData[0]?.total_payments || 0).toFixed(2)}`;

        // Load chart data
        await loadChartData(dateFilter);

        // Load orders table
        await loadOrdersTable(dateFilter);

    } catch (error) {
        console.error("Error loading finance data:", error);
    }
}

// Load chart data
async function loadChartData(dateFilter) {
    try {
        // Revenue by Order Type
        const revenueByTypeSql = `
            SELECT order_type, COALESCE(SUM(total), 0) as revenue
            FROM orders
            WHERE 1=1 ${dateFilter}
            GROUP BY order_type
        `;
        const revenueByTypeData = await safeDbQuery(revenueByTypeSql);

        // Orders by Status
        const ordersByStatusSql = `
            SELECT 
                CASE 
                    WHEN order_status = 'completed' THEN 'Completed'
                    WHEN order_status = 'pending' OR order_status IS NULL THEN 'Pending'
                    ELSE 'Other'
                END as status,
                COUNT(*) as count
            FROM orders
            WHERE 1=1 ${dateFilter}
            GROUP BY status
        `;
        const ordersByStatusData = await safeDbQuery(ordersByStatusSql);

        // Daily Revenue Trend
        const dailyRevenueSql = `
            SELECT 
                date(created_at) as date,
                COALESCE(SUM(total), 0) as revenue
            FROM orders
            WHERE 1=1 ${dateFilter}
            GROUP BY date(created_at)
            ORDER BY date(created_at)
        `;
        const dailyRevenueData = await safeDbQuery(dailyRevenueSql);

        // Daily Orders Trend
        const dailyOrdersSql = `
            SELECT 
                date(created_at) as date,
                COUNT(*) as count
            FROM orders
            WHERE 1=1 ${dateFilter}
            GROUP BY date(created_at)
            ORDER BY date(created_at)
        `;
        const dailyOrdersData = await safeDbQuery(dailyOrdersSql);

        // Render charts
        renderRevenueByTypeChart(revenueByTypeData);
        renderOrdersByStatusChart(ordersByStatusData);
        renderDailyRevenueChart(dailyRevenueData);
        renderDailyOrdersChart(dailyOrdersData);

    } catch (error) {
        console.error("Error loading chart data:", error);
    }
}

// Render Revenue by Order Type Chart
function renderRevenueByTypeChart(data) {
    const ctx = document.getElementById("revenueByTypeChart");
    if (!ctx) return;

    if (revenueByTypeChart) {
        revenueByTypeChart.destroy();
    }

    const labels = data.map(item => item.order_type || 'Unknown');
    const revenues = data.map(item => parseFloat(item.revenue || 0));

    revenueByTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (Rs.)',
                data: revenues,
                backgroundColor: [
                    'rgba(76, 175, 80, 0.8)',
                    'rgba(33, 150, 243, 0.8)',
                    'rgba(255, 152, 0, 0.8)',
                    'rgba(156, 39, 176, 0.8)',
                    'rgba(244, 67, 54, 0.8)'
                ],
                borderColor: [
                    'rgba(76, 175, 80, 1)',
                    'rgba(33, 150, 243, 1)',
                    'rgba(255, 152, 0, 1)',
                    'rgba(156, 39, 176, 1)',
                    'rgba(244, 67, 54, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#333',
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': Rs. ' + context.parsed.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

// Render Orders by Status Chart
function renderOrdersByStatusChart(data) {
    const ctx = document.getElementById("ordersByStatusChart");
    if (!ctx) return;

    if (ordersByStatusChart) {
        ordersByStatusChart.destroy();
    }

    const labels = data.map(item => item.status || 'Unknown');
    const counts = data.map(item => parseInt(item.count || 0));

    ordersByStatusChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Orders',
                data: counts,
                backgroundColor: [
                    'rgba(76, 175, 80, 0.8)',
                    'rgba(255, 152, 0, 0.8)',
                    'rgba(158, 158, 158, 0.8)'
                ],
                borderColor: [
                    'rgba(76, 175, 80, 1)',
                    'rgba(255, 152, 0, 1)',
                    'rgba(158, 158, 158, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#333',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// Render Daily Revenue Chart
function renderDailyRevenueChart(data) {
    const ctx = document.getElementById("dailyRevenueChart");
    if (!ctx) return;

    if (dailyRevenueChart) {
        dailyRevenueChart.destroy();
    }

    const labels = data.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const revenues = data.map(item => parseFloat(item.revenue || 0));

    dailyRevenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Revenue (Rs.)',
                data: revenues,
                borderColor: 'rgba(76, 175, 80, 1)',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#333'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'Rs. ' + value.toFixed(0);
                        },
                        color: '#333'
                    },
                    title: {
                        display: true,
                        text: 'Revenue (Rs.)',
                        color: '#333'
                    }
                },
                x: {
                    ticks: {
                        color: '#333'
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: '#333'
                    }
                }
            }
        }
    });
}

// Render Daily Orders Chart
function renderDailyOrdersChart(data) {
    const ctx = document.getElementById("dailyOrdersChart");
    if (!ctx) return;

    if (dailyOrdersChart) {
        dailyOrdersChart.destroy();
    }

    const labels = data.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const counts = data.map(item => parseInt(item.count || 0));

    dailyOrdersChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Orders',
                data: counts,
                backgroundColor: 'rgba(33, 150, 243, 0.8)',
                borderColor: 'rgba(33, 150, 243, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#333'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#333'
                    },
                    title: {
                        display: true,
                        text: 'Number of Orders',
                        color: '#333'
                    }
                },
                x: {
                    ticks: {
                        color: '#333'
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: '#333'
                    }
                }
            }
        }
    });
}

// Load orders table
async function loadOrdersTable(dateFilter) {
    try {
        const ordersSql = `
            SELECT id, order_type, customer_name, table_number, total, created_at, order_status, payment_status
            FROM orders
            WHERE 1=1 ${dateFilter}
            ORDER BY created_at DESC
        `;
        const orders = await safeDbQuery(ordersSql);

        const tbody = document.getElementById("orders-table-body");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #aaa;">No orders found</td></tr>';
            return;
        }

        orders.forEach(order => {
            const tr = document.createElement("tr");
            tr.style.backgroundColor = "white";
            const date = new Date(order.created_at);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            
            // Determine customer/table display
            let customerTableDisplay = '-';
            if (order.order_type === 'Table') {
                const tableNum = order.table_number;
                if (tableNum !== null && tableNum !== undefined && tableNum !== '' && !isNaN(tableNum)) {
                    customerTableDisplay = `Table ${tableNum}`;
                } else {
                    customerTableDisplay = 'Table (No #)';
                }
            } else if (order.customer_name) {
                customerTableDisplay = order.customer_name;
            }

            const orderStatus = order.order_status || 'pending';
            const paymentStatus = order.payment_status || 'pending';
            const orderStatusClass = orderStatus === 'completed' ? 'status-completed' : 'status-pending';
            const paymentStatusClass = paymentStatus === 'paid' ? 'status-completed' : 'status-pending';

            tr.innerHTML = `
                <td>#${order.id}</td>
                <td>${order.order_type}</td>
                <td>${customerTableDisplay}</td>
                <td>${dateStr} ${timeStr}</td>
                <td>Rs. ${parseFloat(order.total).toFixed(2)}</td>
                <td><span class="${orderStatusClass}">${orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1)}</span></td>
                <td><span class="${paymentStatusClass}">${paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}</span></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error loading orders table:", error);
    }
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
    initWebChannel();

    const applyFilterBtn = document.getElementById("applyFilter");
    const resetFilterBtn = document.getElementById("resetFilter");

    if (applyFilterBtn) {
        applyFilterBtn.addEventListener("click", () => {
            loadFinanceData();
        });
    }

    if (resetFilterBtn) {
        resetFilterBtn.addEventListener("click", () => {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            document.getElementById("dateFrom").value = firstDay.toISOString().split('T')[0];
            document.getElementById("dateTo").value = today.toISOString().split('T')[0];
            loadFinanceData();
        });
    }
});
