let dbBackend = null;
let menuItems = [];
let selectedItems = {};
let currentOrderId = null;
let filteredMenuItems = [];

// Helper function to safely execute database queries
async function safeDbQuery(sql, params = null) {
    if (!dbBackend) {
        console.error("Database backend not initialized");
        return [];
    }

    try {
        let response;

        if (params && Array.isArray(params) && params.length > 0) {
            // Use parameterized query
            const paramsJson = JSON.stringify(params);
            response = dbBackend.execute_with_params(sql, paramsJson);
        } else {
            // Use direct query
            response = dbBackend.execute_query(sql);
        }

        // Handle Promise if the method returns one
        if (response && typeof response.then === 'function') {
            console.log("Database query returned a Promise, awaiting...");
            response = await response;
        }

        // If still a Promise, wait for it again
        if (response && typeof response.then === 'function') {
            response = await response;
        }

        // Check if response is a string
        if (typeof response !== 'string') {
            console.error("Invalid response type from database:", typeof response, response);
            // Try to convert to string if it's an object
            if (typeof response === 'object' && response !== null) {
                try {
                    response = JSON.stringify(response);
                } catch (e) {
                    return [];
                }
            } else {
                return [];
            }
        }

        // Parse JSON
        const result = JSON.parse(response || "[]");

        // If it's a SELECT query with params, result is an array
        if (Array.isArray(result)) {
            return result;
        } else if (result.error) {
            console.error("Database query error:", result.error);
            return [];
        } else {
            return [];
        }
    } catch (error) {
        console.error("Error executing database query:", error, sql);
        return [];
    }
}

// Helper function to safely execute database updates
async function safeDbUpdate(sql, params) {
    if (!dbBackend) {
        console.error("Database backend not initialized");
        return { error: "Database backend not initialized" };
    }

    try {
        const paramsJson = JSON.stringify(params);
        let response = dbBackend.execute_with_params(sql, paramsJson);

        // Handle Promise if returned
        if (response && typeof response.then === 'function') {
            response = await response;
        }

        // Check if response is a string
        if (typeof response !== 'string') {
            console.error("Invalid response type from database:", typeof response, response);
            return { error: "Invalid response from database" };
        }

        // Parse JSON
        return JSON.parse(response || "{}");
    } catch (error) {
        console.error("Error executing database update:", error, sql);
        return { error: error.message };
    }
}

// Initialize Qt WebChannel
function initWebChannel() {
    if (typeof QWebChannel === 'undefined') {
        console.log("Waiting for QWebChannel to load...");
        setTimeout(initWebChannel, 100);
        return;
    }

    if (typeof qt !== 'undefined' && qt.webChannelTransport) {
        try {
            console.log("Initializing WebChannel...");
            new QWebChannel(qt.webChannelTransport, function (channel) {
                console.log("WebChannel connected!", channel.objects);
                window.dbBackend = channel.objects.dbBackend;
                dbBackend = channel.objects.dbBackend;

                if (dbBackend) {
                    console.log("Database backend initialized successfully!");
                    // Load menu items for order editing (async, don't wait)
                    setTimeout(() => { if (typeof loadMenuItems === 'function') { loadMenuItems(); } else { setTimeout(() => { if (typeof loadMenuItems === 'function') { loadMenuItems(); } }, 500); } }, 100);
                    // Test database connection
                    const testQuery = "SELECT 1 as test";
                    const testResult = dbBackend.execute_query(testQuery);
                    // Handle Promise if returned
                    if (testResult && typeof testResult.then === 'function') {
                        testResult.then(result => {
                            console.log("Database test query result:", result);
                        }).catch(err => {
                            console.error("Database test query error:", err);
                        });
                    } else {
                        console.log("Database test query result:", testResult);
                    }
                } else {
                    console.error("Database backend not found in channel objects");
                }

                loadDashboardData();
            });
        } catch (error) {
            console.error("Error initializing WebChannel:", error);
        }
    } else {
        console.warn("Qt WebChannel not available. qt:", typeof qt, "webChannelTransport:", typeof qt?.webChannelTransport);
    }
}

// Load all dashboard data from database
async function loadDashboardData() {
    if (!dbBackend) {
        console.error("Database backend not initialized");
        return;
    }

    await loadKPIs();
    await loadRecentOrders();
    await loadCharts();
}

// Load KPI values
async function loadKPIs() {
    const today = new Date().toISOString().split('T')[0];
    console.log("Loading KPIs for date:", today);

    // Today's orders
    const todayOrdersSql = `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE date(created_at) = '${today}'`;
    const todayData = await safeDbQuery(todayOrdersSql);
    console.log("Today's data:", todayData);

    // Total orders
    const totalOrdersSql = "SELECT COUNT(*) as count FROM orders";
    const totalOrdersData = await safeDbQuery(totalOrdersSql);

    // Monthly orders (last 30 days)
    const monthlyOrdersSql = `SELECT COUNT(*) as count FROM orders WHERE created_at >= datetime('now', '-30 days')`;
    const monthlyOrdersData = await safeDbQuery(monthlyOrdersSql);

    // Top item
    const topItemSql = `
        SELECT mi.name, SUM(oi.quantity) as total_qty 
        FROM order_items oi 
        JOIN menu_items mi ON oi.menu_item_id = mi.id 
        GROUP BY mi.id 
        ORDER BY total_qty DESC 
        LIMIT 1
    `;
    const topItemData = await safeDbQuery(topItemSql);

    // Update KPI values
    const todayOrders = todayData[0]?.count || 0;
    const todayRevenue = todayData[0]?.revenue || 0;
    const totalOrders = totalOrdersData[0]?.count || 0;
    const monthlyOrders = monthlyOrdersData[0]?.count || 0;
    const topItem = topItemData[0]?.name || "N/A";

    console.log("KPI Values:", {
        todayOrders,
        todayRevenue,
        totalOrders,
        monthlyOrders,
        topItem
    });

    const kpiValues = document.querySelectorAll(".kpi-value");
    if (kpiValues.length >= 7) {
        kpiValues[0].textContent = todayOrders;
        kpiValues[1].textContent = todayOrders; // Completed (same for now)
        kpiValues[2].textContent = 0; // Cancelled
        kpiValues[3].textContent = `Rs. ${parseFloat(todayRevenue).toLocaleString()}`;
        kpiValues[4].textContent = totalOrders;
        kpiValues[5].textContent = monthlyOrders;
        kpiValues[6].textContent = topItem;
    } else {
        console.error("Not enough KPI value elements found. Expected 7, found:", kpiValues.length);
    }
}

// Load all orders table
async function loadRecentOrders() {
    const sql = `
        SELECT id, order_type, customer_name, table_number, total, created_at, order_status, payment_status
        FROM orders 
        ORDER BY created_at DESC
    `;
    const orders = await safeDbQuery(sql);

    const tbody = document.querySelector(".orders-table tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!orders || orders.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = '<td colspan="6" style="text-align: center; color: white; padding: 20px;">No orders found</td>';
        tbody.appendChild(tr);
        return;
    }

    orders.forEach(order => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.style.backgroundColor = "white";
        const date = new Date(order.created_at);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const status = order.order_status || 'pending';
        const statusClass = status === 'completed' ? 'status-completed' : 'status-pending';
        const statusText = status === 'completed' ? 'Completed' : 'Pending';

        // Determine customer/table display
        let customerTableDisplay = '-';
        if (order.order_type === 'Table') {
            // For table orders, show table number (check explicitly for null/undefined/empty)
            const tableNum = order.table_number;
            if (tableNum !== null && tableNum !== undefined && tableNum !== '' && !isNaN(tableNum)) {
                customerTableDisplay = `Table ${tableNum}`;
            } else {
                customerTableDisplay = 'Table (No #)';
            }
        } else if (order.customer_name) {
            customerTableDisplay = order.customer_name;
        }

        tr.innerHTML = `
            <td>#${order.id}</td>
            <td>${order.order_type || '-'}</td>
            <td>${customerTableDisplay}</td>
            <td>Rs. ${parseFloat(order.total || 0).toFixed(2)}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${dateStr} ${timeStr}</td>
        `;
        tr.addEventListener("click", () => openEditOrderModal(order.id));
        tbody.appendChild(tr);
    });
}

// Store chart instances to allow updates
let monthlyOrdersChart = null;
let monthlyRevenueChart = null;

// Load charts with real data
async function loadCharts() {
    async function initCharts() {
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.log("Chart.js not loaded, retrying...");
            setTimeout(() => initCharts(), 200);
            return;
        }

        console.log("Chart.js version:", Chart.version || "loaded");

        const monthlyOrdersCanvas = document.getElementById("monthlyOrdersChart");
        const monthlyRevenueCanvas = document.getElementById("monthlyRevenueChart");

        if (!monthlyOrdersCanvas) {
            console.error("monthlyOrdersChart canvas not found");
            setTimeout(() => initCharts(), 200);
            return;
        }

        if (!monthlyRevenueCanvas) {
            console.error("monthlyRevenueChart canvas not found");
            setTimeout(() => initCharts(), 200);
            return;
        }

        console.log("Canvas elements found, proceeding with chart creation...");

        console.log("Loading chart data from database...");

        // Get day-by-day data for current month
        const dailyOrdersSql = `
            SELECT 
                strftime('%Y-%m-%d', created_at) as day,
                COUNT(*) as count,
                COALESCE(SUM(total), 0) as revenue
            FROM orders 
            WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
            GROUP BY day
            ORDER BY day
        `;
        const dailyData = await safeDbQuery(dailyOrdersSql);
        console.log("Daily data:", dailyData);

        // Prepare chart data - day by day for current month
        let dayLabels = [];
        let orderCounts = [];
        let revenueData = [];

        if (dailyData.length > 0) {
            // Format dates for x-axis: "Jan 18", "Jan 19", etc.
            dayLabels = dailyData.map(d => {
                const date = new Date(d.day + 'T00:00:00'); // Add time to avoid timezone issues
                const month = date.toLocaleDateString('en-US', { month: 'short' });
                const day = date.getDate();
                return `${month} ${day}`;
            });
            orderCounts = dailyData.map(d => parseInt(d.count) || 0);
            revenueData = dailyData.map(d => parseFloat(d.revenue) || 0);
        } else {
            // Fallback: show last 7 days with zeros
            const days = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const month = date.toLocaleDateString('en-US', { month: 'short' });
                const day = date.getDate();
                days.push(`${month} ${day}`);
            }
            dayLabels = days;
            orderCounts = [0, 0, 0, 0, 0, 0, 0];
            revenueData = [0, 0, 0, 0, 0, 0, 0];
        }

        // Destroy existing charts if they exist
        if (monthlyOrdersChart) {
            monthlyOrdersChart.destroy();
            monthlyOrdersChart = null;
        }
        if (monthlyRevenueChart) {
            monthlyRevenueChart.destroy();
            monthlyRevenueChart = null;
        }

        console.log("Creating charts with data:", {
            dayLabels: dayLabels,
            orderCounts: orderCounts,
            revenueData: revenueData
        });

        // Daily Orders Bar Chart
        try {
            const monthlyOrdersCtx = monthlyOrdersCanvas.getContext("2d");
            if (!monthlyOrdersCtx) {
                console.error("Could not get 2d context for daily orders chart");
                return;
            }

            console.log("Creating daily orders bar chart with", dayLabels.length, "data points");
            monthlyOrdersChart = new Chart(monthlyOrdersCtx, {
                type: "bar",
    data: {
                    labels: dayLabels,
        datasets: [{
            label: "Orders",
                        data: orderCounts,
                        backgroundColor: "#4caf50",
                        borderColor: "#45a049",
                        borderWidth: 1
        }]
    },
    options: {
        responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: 'Daily Orders (This Month)',
                            font: { size: 16, weight: 'bold' },
                            color: '#fff'
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return 'Orders: ' + context.parsed.y;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Orders',
                                color: '#fff',
                                font: { size: 12, weight: 'bold' }
                            },
                            ticks: {
                                stepSize: 1,
                                precision: 0,
                                color: '#fff',
                                font: { size: 12 },
                                callback: function (value) {
                                    return Number.isInteger(value) ? value : '';
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawBorder: true,
                                borderColor: 'rgba(255, 255, 255, 0.2)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Date',
                                color: '#fff',
                                font: { size: 12, weight: 'bold' }
                            },
                            ticks: {
                                color: '#fff',
                                font: { size: 11 },
                                maxRotation: 45,
                                minRotation: 0
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawBorder: true,
                                borderColor: 'rgba(255, 255, 255, 0.2)'
                            }
                        }
                    }
                }
            });
            console.log("Daily Orders Bar Chart created successfully");
        } catch (error) {
            console.error("Error creating daily orders chart:", error);
        }

        // Daily Revenue Bar Chart
        try {
            const monthlyRevenueCtx = monthlyRevenueCanvas.getContext("2d");
            if (!monthlyRevenueCtx) {
                console.error("Could not get 2d context for daily revenue chart");
                return;
            }

            console.log("Creating daily revenue bar chart with", dayLabels.length, "data points");
            monthlyRevenueChart = new Chart(monthlyRevenueCtx, {
                type: "bar",
    data: {
                    labels: dayLabels,
        datasets: [{
                        label: "Revenue (Rs.)",
                        data: revenueData,
                        backgroundColor: "#ff9800",
                        borderColor: "#f57c00",
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: 'Daily Revenue (This Month)',
                            font: { size: 16, weight: 'bold' },
                            color: '#fff'
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return 'Revenue: Rs. ' + context.parsed.y.toLocaleString();
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Revenue (Rs.)',
                                color: '#fff',
                                font: { size: 12, weight: 'bold' }
                            },
                            ticks: {
                                callback: function (value) {
                                    return 'Rs. ' + Math.round(value).toLocaleString();
                                },
                                color: '#fff',
                                font: { size: 12 },
                                stepSize: 1000
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawBorder: true,
                                borderColor: 'rgba(255, 255, 255, 0.2)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Date',
                                color: '#fff',
                                font: { size: 12, weight: 'bold' }
                            },
                            ticks: {
                                color: '#fff',
                                font: { size: 11 },
                                maxRotation: 45,
                                minRotation: 0
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawBorder: true,
                                borderColor: 'rgba(255, 255, 255, 0.2)'
                            }
                        }
                    }
                }
            });
            console.log("Daily Revenue Bar Chart created successfully");
        } catch (error) {
            console.error("Error creating daily revenue chart:", error);
        }

        console.log("Charts initialization completed!");
    }

    // Wait for Chart.js to be fully loaded
    function waitForChartJS() {
        if (typeof Chart !== 'undefined') {
            console.log("Chart.js is ready, initializing charts...");
            setTimeout(initCharts, 300);
        } else {
            console.log("Waiting for Chart.js...");
            setTimeout(waitForChartJS, 200);
        }
    }

    waitForChartJS();
}

document.addEventListener("DOMContentLoaded", () => {
    // Set active nav link
    document.querySelectorAll(".nav-links button").forEach(btn => {
        if (btn.innerText.includes(document.title)) {
            btn.classList.add("active");
        }
    });

    // Initialize WebChannel
    initWebChannel();
});

// Load menu items from database
async function loadMenuItems() {
    if (!dbBackend) {
        console.error("Database backend not initialized");
        setTimeout(loadMenuItems, 500);
        return;
    }

    try {
        const sql = "SELECT id, name, category, price, is_available FROM menu_items WHERE is_available = 1 ORDER BY category, name";
        const items = await safeDbQuery(sql);

        if (!Array.isArray(items)) {
            console.error("Invalid menu items response:", items);
            menuItems = [];
            return;
        }

        menuItems = items;
        console.log("Loaded menu items:", menuItems.length);
    } catch (error) {
        console.error("Error loading menu items:", error);
        menuItems = [];
    }
}

// Open edit order modal
async function openEditOrderModal(orderId) {
    currentOrderId = orderId;
    selectedItems = {};

    // Load order details
    const orderSql = `SELECT * FROM orders WHERE id = ?`;
    const orders = await safeDbQuery(orderSql, [orderId]);
    if (!orders || orders.length === 0) {
        alert("Order not found");
        return;
    }
    const order = orders[0];

    // Load order items
    const orderItemsSql = `
        SELECT oi.id, oi.menu_item_id, oi.quantity, oi.price, mi.name, mi.category
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
    `;
    const items = await safeDbQuery(orderItemsSql, [orderId]);

    // Populate selectedItems
    items.forEach(item => {
        selectedItems[item.menu_item_id] = {
            id: item.menu_item_id,
            name: item.name,
            price: item.price,
            qty: item.quantity,
            order_item_id: item.id
        };
    });

    const modal = document.getElementById("orderModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalContent = document.getElementById("modalContent");

    // Determine customer/table display
    let customerTableDisplay = '-';
    if (order.order_type === 'Table') {
        // For table orders, show table number (even if 0 or null, show something)
        if (order.table_number !== null && order.table_number !== undefined) {
            customerTableDisplay = `Table ${order.table_number}`;
        } else {
            customerTableDisplay = 'Table (No #)';
        }
    } else if (order.customer_name) {
        customerTableDisplay = order.customer_name;
    }

    modalTitle.textContent = `Order #${order.id} - ${order.order_type}`;
    modalTitle.style.color = "white";
    modalContent.innerHTML = `
        <div class="order-modal-body">
            <div class="order-details-section">
                <div class="order-info">
                    <p><strong>Order ID:</strong> #${order.id}</p>
                    <p><strong>Type:</strong> ${order.order_type}</p>
                    <p><strong>Customer/Table:</strong> ${customerTableDisplay}</p>
                    ${order.customer_name ? `<p><strong>Customer Name:</strong> <input type="text" id="editCustomerName" value="${order.customer_name || ''}" style="padding: 5px; width: 200px; border-radius: 4px; border: 1px solid #2A2A2A; background-color: white; color: black;"></p>` : ''}
                    ${order.customer_phone ? `<p><strong>Phone:</strong> <input type="text" id="editCustomerPhone" value="${order.customer_phone || ''}" style="padding: 5px; width: 200px; border-radius: 4px; border: 1px solid #2A2A2A; background-color: white; color: black;"></p>` : ''}
                    ${order.table_number ? `<p><strong>Table Number:</strong> ${order.table_number}</p>` : ''}
                    <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                    <p><strong>Order Status:</strong> <span class="${order.order_status === 'completed' ? 'status-completed' : 'status-pending'}" id="orderStatusDisplay">${order.order_status === 'completed' ? 'Completed' : 'Pending'}</span></p>
                    <p><strong>Payment Status:</strong> <span class="${order.payment_status === 'paid' ? 'status-completed' : 'status-pending'}">${order.payment_status === 'paid' ? 'Paid' : 'Pending'}</span></p>
                </div>
            </div>
            <div class="takeaway-order-layout">
                <!-- Left Side: Menu Items -->
                <div class="takeaway-menu-section">
                    <h3>Menu Items</h3>
                    <input type="text" id="menuSearchInput" class="menu-search-input" placeholder="Search menu items..." oninput="filterMenuItems()">
                    <div class="menu-items-grid" id="menuItemsGrid">
                        ${renderMenuItems()}
                    </div>
                </div>
                <!-- Right Side: Order Summary -->
                <div class="takeaway-order-summary">
                    <h3>Order Items</h3>
                    <div id="selectedItemsListModal" class="selected-items-list"></div>
                    <div class="order-total">
                        <strong>Total: <span id="orderTotal">Rs. ${parseFloat(order.total || 0).toFixed(2)}</span></strong>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary" onclick="closeOrderModal()">Close</button>
                        <button class="btn-warning" onclick="updateOrder()">Update Order</button>
                        <button class="btn-success" onclick="toggleOrderStatus()">${order.order_status === 'completed' ? 'Mark Pending' : 'Mark Complete'}</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.style.display = "block";
    updateOrderSummaryModal();
    filteredMenuItems = [];
}

// Filter menu items based on search
function filterMenuItems() {
    const searchInput = document.getElementById("menuSearchInput");
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (searchTerm === '') {
        filteredMenuItems = [];
    } else {
        filteredMenuItems = menuItems.filter(item =>
            item.name.toLowerCase().includes(searchTerm) ||
            (item.category && item.category.toLowerCase().includes(searchTerm))
        );
    }

    const menuGrid = document.getElementById("menuItemsGrid");
    if (menuGrid) {
        menuGrid.innerHTML = renderMenuItems();
    }
}

// Render menu items for modal
function renderMenuItems() {
    const itemsToRender = filteredMenuItems.length > 0 ? filteredMenuItems : menuItems;

    if (!itemsToRender || itemsToRender.length === 0) {
        return '<p class="empty-message">No menu items found</p>';
    }

    return itemsToRender.map(item => {
        const isSelected = selectedItems[item.id] ? 'selected' : '';
        return `
            <div class="menu-item-card ${isSelected}" onclick="toggleMenuItem(${item.id})">
                <div class="menu-item-name">${item.name || 'Unknown Item'}</div>
                <div class="menu-item-category">${item.category || 'Uncategorized'}</div>
                <div class="menu-item-price">Rs. ${parseFloat(item.price || 0).toFixed(2)}</div>
                ${isSelected ? `<div class="menu-item-qty">Qty: ${selectedItems[item.id].qty || 0}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Toggle menu item selection
function toggleMenuItem(menuItemId) {
    const item = menuItems.find(m => m.id === menuItemId);
    if (!item) return;

    if (selectedItems[menuItemId]) {
        selectedItems[menuItemId].qty += 1;
    } else {
        selectedItems[menuItemId] = { ...item, qty: 1 };
    }

    const menuGrid = document.getElementById("menuItemsGrid");
    if (menuGrid) {
        menuGrid.innerHTML = renderMenuItems();
    }
    updateOrderSummaryModal();
}

// Update order summary in modal
function updateOrderSummaryModal() {
    const selectedItemsList = document.getElementById("selectedItemsListModal");
    const orderTotal = document.getElementById("orderTotal");

    if (!selectedItemsList) return;

    if (Object.keys(selectedItems).length === 0) {
        selectedItemsList.innerHTML = '<p class="empty-message">No items selected</p>';
        if (orderTotal) orderTotal.textContent = 'Rs. 0.00';
        return;
    }

    let total = 0;
    selectedItemsList.innerHTML = Object.values(selectedItems).map(item => {
        const itemTotal = parseFloat(item.price) * item.qty;
        total += itemTotal;
        const itemId = item.id || 0;
        return `
            <div class="selected-item-row">
                <div class="item-info">
                    <span class="item-name">${item.name || 'Unknown Item'}</span>
                    <span class="item-price">Rs. ${parseFloat(item.price || 0).toFixed(2)} × ${item.qty || 0}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-qty" onclick="decreaseQuantityModal(${itemId})">-</button>
                    <span class="item-qty">${item.qty || 0}</span>
                    <button class="btn-qty" onclick="increaseQuantityModal(${itemId})">+</button>
                    <button class="btn-remove" onclick="removeItemModal(${itemId})">×</button>
                </div>
            </div>
        `;
    }).join('');

    if (orderTotal) orderTotal.textContent = `Rs. ${total.toFixed(2)}`;
}

// Quantity controls for modal
function increaseQuantityModal(menuItemId) {
    if (selectedItems[menuItemId]) {
        selectedItems[menuItemId].qty += 1;
        updateOrderSummaryModal();
        const menuGrid = document.getElementById("menuItemsGrid");
        if (menuGrid) {
            menuGrid.innerHTML = renderMenuItems();
        }
    }
}

function decreaseQuantityModal(menuItemId) {
    if (selectedItems[menuItemId]) {
        selectedItems[menuItemId].qty -= 1;
        if (selectedItems[menuItemId].qty <= 0) {
            removeItemModal(menuItemId);
        } else {
            updateOrderSummaryModal();
            const menuGrid = document.getElementById("menuItemsGrid");
            if (menuGrid) {
                menuGrid.innerHTML = renderMenuItems();
            }
        }
    }
}

function removeItemModal(menuItemId) {
    delete selectedItems[menuItemId];
    updateOrderSummaryModal();
    const menuGrid = document.getElementById("menuItemsGrid");
    if (menuGrid) {
        menuGrid.innerHTML = renderMenuItems();
    }
}

// Close order modal
function closeOrderModal() {
    const modal = document.getElementById("orderModal");
    if (modal) {
        modal.style.display = "none";
    }
    currentOrderId = null;
    selectedItems = {};
}

// Update existing order
async function updateOrder() {
    if (Object.keys(selectedItems).length === 0) {
        alert("Please select at least one item");
        return;
    }

    if (!currentOrderId || !dbBackend) {
        alert("Invalid order or database not initialized");
        return;
    }

    try {
        // Get updated customer info
        const editCustomerNameInput = document.getElementById("editCustomerName");
        const editCustomerPhoneInput = document.getElementById("editCustomerPhone");
        const customerName = editCustomerNameInput ? editCustomerNameInput.value.trim() : null;
        const customerPhone = editCustomerPhoneInput ? editCustomerPhoneInput.value.trim() : null;

        // Calculate new total
        const total = Object.values(selectedItems).reduce((sum, item) => {
            return sum + (item.price * item.qty);
        }, 0);

        // Build update query based on order type
        let updateOrderSql;
        let updateParams;

        // Get order to check type
        const orderSql = `SELECT * FROM orders WHERE id = ?`;
        const orders = await safeDbQuery(orderSql, [currentOrderId]);
        if (!orders || orders.length === 0) {
            alert("Order not found");
            return;
        }
        const order = orders[0];

        if (order.order_type === 'Table') {
            // Table orders don't have customer_name/phone
            updateOrderSql = `UPDATE orders SET total = ? WHERE id = ?`;
            updateParams = [total, currentOrderId];
        } else {
            // Takeaway/Delivery orders have customer_name
            if (customerPhone !== null) {
                updateOrderSql = `UPDATE orders SET total = ?, customer_name = ?, customer_phone = ? WHERE id = ?`;
                updateParams = [total, customerName, customerPhone, currentOrderId];
            } else {
                updateOrderSql = `UPDATE orders SET total = ?, customer_name = ? WHERE id = ?`;
                updateParams = [total, customerName, currentOrderId];
            }
        }

        await safeDbUpdate(updateOrderSql, updateParams);

        // Delete existing order items
        const deleteItemsSql = `DELETE FROM order_items WHERE order_id = ?`;
        await safeDbUpdate(deleteItemsSql, [currentOrderId]);

        // Insert new order items
        for (const item of Object.values(selectedItems)) {
            const insertItemSql = `INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)`;
            await safeDbUpdate(insertItemSql, [currentOrderId, item.id, item.qty, item.price]);
        }

        alert("Order updated successfully!");
        closeOrderModal();
        loadRecentOrders();
    } catch (error) {
        console.error("Error updating order:", error);
        alert("Error updating order: " + error.message);
    }
}

// Toggle order status (pending <-> completed)
async function toggleOrderStatus() {
    if (!currentOrderId || !dbBackend) {
        alert("Invalid order or database not initialized");
        return;
    }

    try {
        // Get current order status
        const orderSql = `SELECT order_status, total FROM orders WHERE id = ?`;
        const orders = await safeDbQuery(orderSql, [currentOrderId]);
        if (!orders || orders.length === 0) {
            alert("Order not found");
            return;
        }

        const currentStatus = orders[0].order_status || 'pending';
        const orderTotal = orders[0].total;
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
        const statusText = newStatus === 'completed' ? 'Completed' : 'Pending';

        // Get order details to check if it's a table order
        const orderDetailsSql = `SELECT order_type, table_number FROM orders WHERE id = ?`;
        const orderDetails = await safeDbQuery(orderDetailsSql, [currentOrderId]);
        const isTableOrder = orderDetails && orderDetails.length > 0 && orderDetails[0].order_type === 'Table';

        // Update order status and payment status
        const paymentStatus = newStatus === 'completed' ? 'paid' : 'pending';
        const updateStatusSql = `UPDATE orders SET order_status = ?, payment_status = ? WHERE id = ?`;
        await safeDbUpdate(updateStatusSql, [newStatus, paymentStatus, currentOrderId]);

        // If marking as complete, create payment transaction
        if (newStatus === 'completed') {
            const now = new Date().toISOString();
            const paymentSql = `INSERT INTO payment_transactions (order_id, amount, payment_method, payment_status, created_at) VALUES (?, ?, ?, ?, ?)`;
            await safeDbUpdate(paymentSql, [currentOrderId, orderTotal, 'cash', 'completed', now]);

            // Show invoice print popup
            if (confirm("Order marked as complete! Would you like to print the invoice?")) {
                if (typeof printInvoice === 'function') {
                    await printInvoice(currentOrderId, dbBackend);
                } else {
                    const script = document.createElement('script');
                    script.src = 'js/print_utils.js';
                    script.onload = () => printInvoice(currentOrderId, dbBackend);
                    document.head.appendChild(script);
                }
            }
        }

        // If marking table order as complete, optionally clear table_number to free the table
        // (We'll just filter it out in loadTableOrders instead)

        // Update UI
        const statusDisplay = document.getElementById("orderStatusDisplay");
        if (statusDisplay) {
            statusDisplay.className = newStatus === 'completed' ? 'status-completed' : 'status-pending';
            statusDisplay.textContent = statusText;
        }

        // Update button text
        const statusButton = document.querySelector('.btn-success');
        if (statusButton) {
            statusButton.textContent = newStatus === 'completed' ? 'Mark Pending' : 'Mark Complete';
        }

        alert(`Order status changed to ${statusText}!`);
        loadRecentOrders();

        // If it's a table order, trigger a refresh on the table orders page
        // (This will be handled by the table orders page when it's loaded)
    } catch (error) {
        console.error("Error toggling order status:", error);
        alert("Error changing order status: " + error.message);
    }
}

// Make functions global
window.openEditOrderModal = openEditOrderModal;
window.closeOrderModal = closeOrderModal;
window.updateOrder = updateOrder;
window.toggleOrderStatus = toggleOrderStatus;
window.filterMenuItems = filterMenuItems;
window.toggleMenuItem = toggleMenuItem;
window.increaseQuantityModal = increaseQuantityModal;
window.decreaseQuantityModal = decreaseQuantityModal;
window.removeItemModal = removeItemModal;