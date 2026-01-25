let dbBackend = null;
let menuItems = [];
let selectedItems = {};
let currentTableNumber = null;
let currentOrderId = null;

// Helper function to safely execute database queries
async function safeDbQuery(sql, params = null) {
    const backend = window.dbBackend || dbBackend;
    if (!backend) {
        console.error("Database backend not initialized");
        return [];
    }

    try {
        let response;

        if (params && Array.isArray(params) && params.length > 0) {
            const paramsJson = JSON.stringify(params);
            response = backend.execute_with_params(sql, paramsJson);
        } else {
            response = backend.execute_query(sql);
        }

        // Handle Promise if returned
        if (response && typeof response.then === 'function') {
            response = await response;
        }

        // Check if response is a string
        if (typeof response !== 'string') {
            console.error("Invalid response type from database:", typeof response, response);
            return [];
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
    const backend = window.dbBackend || dbBackend;
    if (!backend) {
        console.error("Database backend not initialized");
        return { error: "Database backend not initialized" };
    }

    try {
        const paramsJson = JSON.stringify(params);
        let response = backend.execute_with_params(sql, paramsJson);

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

// Wait for global WebChannel to be initialized (from webchannel.js)
function waitForWebChannel() {
    if (window._webChannelInitialized && window.dbBackend) {
        dbBackend = window.dbBackend;
        console.log("[TABLE] WebChannel ready, loading data...");
        setTimeout(() => {
            loadMenuItems();
            loadTableOrders();
        }, 100);
    } else {
        console.log("[TABLE] Waiting for WebChannel...");
        setTimeout(waitForWebChannel, 100);
    }
}

// Load menu items
async function loadMenuItems() {
    const sql = "SELECT id, name, category, price, is_available FROM menu_items WHERE is_available = 1 ORDER BY category, name";
    menuItems = await safeDbQuery(sql);
}

// Load table orders - get active orders for each table
async function loadTableOrders() {
    if (!(window.dbBackend || dbBackend)) {
        console.error("Database backend not initialized");
        return;
    }

    const tablesContainer = document.getElementById("tables-container");
    if (!tablesContainer) return;

    tablesContainer.innerHTML = "";

    // Get active table orders (orders with type "Table" and order_status 'pending') grouped by table_number
    const sql = `
        SELECT o.id, o.total, o.created_at, o.table_number, o.order_status
        FROM orders o
        WHERE o.order_type = 'Table' AND o.table_number IS NOT NULL AND (o.order_status IS NULL OR o.order_status = 'pending')
        ORDER BY o.table_number
    `;
    const orders = await safeDbQuery(sql);

    // Create a map of table numbers to orders
    const tableOrderMap = {};
    orders.forEach(order => {
        const tableNum = order.table_number;
        if (tableNum && tableNum >= 1 && tableNum <= 14) {
            tableOrderMap[tableNum] = order;
        }
    });

    // Create 14 table boxes
    for (let i = 1; i <= 14; i++) {
        const order = tableOrderMap[i] || null;

        const tableBox = document.createElement("div");
        tableBox.classList.add("table-box");
        if (order) {
            tableBox.classList.add("has-order");
        }

        const orderNumber = order ? `#${order.id}` : "Empty";
        const invoiceNumber = order ? `INV-${String(order.id).padStart(3, '0')}` : "-";
        const totalBill = order ? `Rs. ${parseFloat(order.total).toFixed(2)}` : "-";

        // Calculate time since order
        let remaining = "-";
        if (order) {
            const orderDate = new Date(order.created_at);
            const now = new Date();
            const diffMinutes = Math.floor((now - orderDate) / (1000 * 60));
            remaining = diffMinutes < 60 ? `${diffMinutes} min` : `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m`;
        }

        const servedClass = order ? "pending" : "";
        const servedText = order ? "Pending" : "Available";

        tableBox.innerHTML = `
            <h2>Table ${i}</h2>
            <p>Order: ${orderNumber}</p>
            <p>Invoice: ${invoiceNumber}</p>
            <p>Total: ${totalBill}</p>
            <p>Time: ${remaining}</p>
            <p class="table-status ${servedClass}">${servedText}</p>
        `;

        tableBox.addEventListener("click", () => {
            if (order) {
                openOrderModal(i, order);
            } else {
                openNewOrderModal(i);
            }
        });

        tablesContainer.appendChild(tableBox);
    }
}

// Open modal for new order
function openNewOrderModal(tableNumber) {
    currentTableNumber = tableNumber;
    currentOrderId = null;
    selectedItems = {};

    const modal = document.getElementById("orderModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalContent = document.getElementById("modalContent");

    modalTitle.textContent = `Table ${tableNumber} - New Order`;
    modalContent.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
            <div class="menu-section">
                <h3>Menu Items</h3>
                <input type="text" id="menuSearchInput" class="menu-search-input" placeholder="Search menu items by name or category..." oninput="filterMenuItems()">
                <div class="menu-items-grid" id="menuItemsGrid">
                    ${renderMenuItems()}
                </div>
            </div>
            <div class="order-summary-section">
                <h3>Order Summary</h3>
                <div id="selectedItemsList" class="selected-items-list"></div>
                <div class="order-total">
                    <strong>Total: <span id="orderTotal">Rs. 0.00</span></strong>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="closeOrderModal()">Cancel</button>
                    <button class="btn-primary" onclick="saveOrder()">Place Order</button>
                </div>
            </div>
        </div>
    `;

    modal.style.display = "block";
    updateOrderSummary();
    // Initialize filtered items
    filteredMenuItems = menuItems;
}

// Open modal for existing order
async function openOrderModal(tableNumber, order) {
    currentTableNumber = tableNumber;
    currentOrderId = order.id;
    selectedItems = {};

    // Load order items
    const orderItemsSql = `
        SELECT oi.id, oi.menu_item_id, oi.quantity, oi.price, mi.name, mi.category
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ${order.id}
    `;
    const items = await safeDbQuery(orderItemsSql);

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

    modalTitle.textContent = `Table ${tableNumber} - Order #${order.id}`;
    modalContent.innerHTML = `
        <div class="order-details-section" style="margin-bottom: 20px;">
            <div class="order-info">
                <p><strong>Order ID:</strong> #${order.id}</p>
                <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                <p><strong>Status:</strong> <span class="status-pending">Pending</span></p>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
            <div class="menu-section">
                <h3 style="color: white;">Menu Items</h3>
                <input type="text" id="menuSearchInput" class="menu-search-input" placeholder="Search menu items by name or category..." oninput="filterMenuItems()">
                <div class="menu-items-grid" id="menuItemsGrid">
                    ${renderMenuItems()}
                </div>
            </div>
            <div class="order-summary-section">
                <h3 style="color: white;">Order Items</h3>
                <div id="selectedItemsList" class="selected-items-list"></div>
                <div class="order-total">
                    <strong>Total: <span id="orderTotal">Rs. ${parseFloat(order.total).toFixed(2)}</span></strong>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="closeOrderModal()">Close</button>
                    <button class="btn-warning" onclick="updateOrder()">Update Order</button>
                    <button class="btn-success" onclick="markOrderComplete()">Mark Complete</button>
                </div>
            </div>
        </div>
    `;

    modal.style.display = "block";
    updateOrderSummary();
    // Initialize filtered items
    filteredMenuItems = menuItems;
}

// Filter menu items based on search
let filteredMenuItems = [];

function filterMenuItems() {
    const searchInput = document.getElementById("menuSearchInput");
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (searchTerm === '') {
        // Show all items when search is empty
        filteredMenuItems = menuItems;
    } else {
        // Filter items by name or category
        filteredMenuItems = menuItems.filter(item =>
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            (item.category && item.category.toLowerCase().includes(searchTerm))
        );
    }

    // Re-render menu items
    const menuGrid = document.getElementById("menuItemsGrid");
    if (menuGrid) {
        menuGrid.innerHTML = renderMenuItems();
    }
}

// Make filterMenuItems globally accessible
window.filterMenuItems = filterMenuItems;

// Render menu items
function renderMenuItems() {
    const itemsToRender = filteredMenuItems.length > 0 ? filteredMenuItems : menuItems;

    if (!itemsToRender || itemsToRender.length === 0) {
        return '<p class="empty-message">No menu items found</p>';
    }

    return itemsToRender.map(item => {
        const isSelected = selectedItems[item.id] ? 'selected' : '';
        return `
            <div class="menu-item-card ${isSelected}" onclick="toggleMenuItem(${item.id})">
                <div class="menu-item-name">${item.name}</div>
                <div class="menu-item-category">${item.category}</div>
                <div class="menu-item-price">Rs. ${parseFloat(item.price).toFixed(2)}</div>
                ${isSelected ? `<div class="menu-item-qty">Qty: ${selectedItems[item.id].qty}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Toggle menu item selection
function toggleMenuItem(menuItemId) {
    const item = menuItems.find(m => m.id === menuItemId);
    if (!item) return;

    if (selectedItems[menuItemId]) {
        // Increase quantity
        selectedItems[menuItemId].qty += 1;
    } else {
        // Add new item
        selectedItems[menuItemId] = {
            id: item.id,
            name: item.name,
            price: item.price,
            qty: 1
        };
    }

    // Re-render menu items and summary
    const menuGrid = document.getElementById("menuItemsGrid");
    if (menuGrid) {
        menuGrid.innerHTML = renderMenuItems();
    }
    updateOrderSummary();
}

// Update order summary
function updateOrderSummary() {
    const selectedItemsList = document.getElementById("selectedItemsList");
    const orderTotal = document.getElementById("orderTotal");

    if (!selectedItemsList) return;

    if (Object.keys(selectedItems).length === 0) {
        selectedItemsList.innerHTML = '<p class="empty-message">No items selected</p>';
        if (orderTotal) orderTotal.textContent = 'Rs. 0.00';
        return;
    }

    let total = 0;
    selectedItemsList.innerHTML = Object.values(selectedItems).map(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        return `
            <div class="selected-item-row">
                <div class="item-info">
                    <span class="item-name">${item.name}</span>
                    <span class="item-price">Rs. ${parseFloat(item.price).toFixed(2)} × ${item.qty}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-qty" onclick="decreaseQuantity(${item.id})">-</button>
                    <span class="item-qty">${item.qty}</span>
                    <button class="btn-qty" onclick="increaseQuantity(${item.id})">+</button>
                    <button class="btn-remove" onclick="removeItem(${item.id})">×</button>
                </div>
            </div>
        `;
    }).join('');

    if (orderTotal) orderTotal.textContent = `Rs. ${total.toFixed(2)}`;
}

// Quantity controls
function increaseQuantity(menuItemId) {
    if (selectedItems[menuItemId]) {
        selectedItems[menuItemId].qty += 1;
        updateOrderSummary();
        const menuGrid = document.getElementById("menuItemsGrid");
        if (menuGrid) {
            menuGrid.innerHTML = renderMenuItems();
        }
    }
}

function decreaseQuantity(menuItemId) {
    if (selectedItems[menuItemId]) {
        selectedItems[menuItemId].qty -= 1;
        if (selectedItems[menuItemId].qty <= 0) {
            removeItem(menuItemId);
        } else {
            updateOrderSummary();
            const menuGrid = document.getElementById("menuItemsGrid");
            if (menuGrid) {
                menuGrid.innerHTML = renderMenuItems();
            }
        }
    }
}

function removeItem(menuItemId) {
    delete selectedItems[menuItemId];
    updateOrderSummary();
    const menuGrid = document.getElementById("menuItemsGrid");
    if (menuGrid) {
        menuGrid.innerHTML = renderMenuItems();
    }
}

// Save new order
async function saveOrder() {
    if (Object.keys(selectedItems).length === 0) {
        alert("Please select at least one item");
        return;
    }

    if (!(window.dbBackend || dbBackend)) {
        alert("Database not initialized");
        return;
    }

    // Check if table already has an active (pending) order
    const checkTableSql = `SELECT id FROM orders WHERE order_type = 'Table' AND table_number = ? AND (order_status IS NULL OR order_status = 'pending')`;
    const existingOrder = await safeDbQuery(checkTableSql, [currentTableNumber]);

    if (existingOrder && existingOrder.length > 0) {
        alert(`Table ${currentTableNumber} already has an active order. Please complete or update the existing order first.`);
        return;
    }

    try {
        // Calculate total
        const total = Object.values(selectedItems).reduce((sum, item) => {
            return sum + (item.price * item.qty);
        }, 0);

        // Insert order with table number
        const now = new Date().toISOString();
        const insertOrderSql = `INSERT INTO orders (order_type, total, created_at, table_number, order_status, payment_status) VALUES (?, ?, ?, ?, ?, ?)`;
        const result = await safeDbUpdate(insertOrderSql, ['Table', total, now, currentTableNumber, 'pending', 'pending']);

        console.log("Order insert result:", result);
        console.log("Result type:", typeof result);
        console.log("Result keys:", result ? Object.keys(result) : "null");

        if (!result || result.success === false) {
            alert("Error saving order: " + (result?.error || "Unknown error"));
            return;
        }

        // Get order id from backend response
        // Try different possible property names
        const orderId = result.last_insert_id || result.lastInsertId || result.id;

        console.log("Order ID from result:", orderId);
        console.log("Order ID type:", typeof orderId);
        console.log("Full result object:", result);

        // Check if orderId is valid (should be a positive integer)
        // Convert to number if it's a string
        const numericOrderId = parseInt(orderId);

        if (isNaN(numericOrderId) || numericOrderId <= 0) {
            console.error("Invalid order ID:", orderId, "Numeric:", numericOrderId, "Full result:", JSON.stringify(result));
            const lastOrderSql = "SELECT id FROM orders ORDER BY id DESC LIMIT 1";
            const lastOrder = await safeDbQuery(lastOrderSql);
            if (lastOrder && lastOrder.length > 0) {
                const fallbackOrderId = parseInt(lastOrder[0].id);
                if (fallbackOrderId && fallbackOrderId > 0) {
                    await insertOrderItems(fallbackOrderId);
                    const wantPrint = await showConfirmModal("Order placed successfully! Would you like to print the receipt?");
                    if (wantPrint) {
                        try {
                            if (typeof printOrderReceipt === 'function') {
                                await printOrderReceipt(fallbackOrderId, dbBackend);
                            } else {
                                const script = document.createElement('script');
                                script.src = 'js/print_utils.js';
                                script.onload = async () => {
                                    if (typeof printOrderReceipt === 'function') {
                                        await printOrderReceipt(fallbackOrderId, dbBackend);
                                    } else alert("Error: Print function not available");
                                };
                                script.onerror = () => alert("Error loading print utilities");
                                document.head.appendChild(script);
                            }
                        } catch (e) {
                            console.error("[TABLE] Error printing receipt:", e);
                            alert("Error printing receipt: " + e.message);
                        }
                    }
                    closeOrderModal();
                    loadTableOrders();
                    return;
                }
            }
            alert("Error getting order ID. Please check console for details.");
            return;
        }

        // Use the numeric order ID
        const finalOrderId = numericOrderId;

        // Insert order items using the order ID
        await insertOrderItems(finalOrderId);

        const wantPrint = await showConfirmModal("Order placed successfully! Would you like to print the receipt?");
        if (wantPrint) {
            try {
                if (typeof printOrderReceipt === 'function') {
                    await printOrderReceipt(finalOrderId, dbBackend);
                } else {
                    const script = document.createElement('script');
                    script.src = 'js/print_utils.js';
                    script.onload = async () => {
                        if (typeof printOrderReceipt === 'function') {
                            await printOrderReceipt(finalOrderId, dbBackend);
                        } else alert("Error: Print function not available");
                    };
                    script.onerror = () => alert("Error loading print utilities");
                    document.head.appendChild(script);
                }
            } catch (error) {
                console.error("[TABLE] Error printing receipt:", error);
                alert("Error printing receipt: " + error.message);
            }
        }

        closeOrderModal();
        loadTableOrders();

    } catch (error) {
        console.error("Error saving order:", error);
        alert("Error saving order: " + error.message);
    }
}

// Helper function to insert order items
async function insertOrderItems(orderId) {
    for (const item of Object.values(selectedItems)) {
        const insertItemSql = `
            INSERT INTO order_items (order_id, menu_item_id, quantity, price)
            VALUES (?, ?, ?, ?)
        `;
        const itemResult = await safeDbUpdate(insertItemSql, [
            orderId,
            item.id,
            item.qty,
            item.price
        ]);

        if (!itemResult || itemResult.success === false) {
            console.error("Error inserting order item:", itemResult);
            throw new Error("Failed to insert order item: " + (itemResult?.error || "Unknown error"));
        }
    }
}

// Update existing order
async function updateOrder() {
    if (Object.keys(selectedItems).length === 0) {
        alert("Please select at least one item");
        return;
    }

    if (!currentOrderId || !(window.dbBackend || dbBackend)) {
        alert("Invalid order or database not initialized");
        return;
    }

    try {
        // Calculate new total
        const total = Object.values(selectedItems).reduce((sum, item) => {
            return sum + (item.price * item.qty);
        }, 0);

        // Update order total
        const updateOrderSql = `UPDATE orders SET total = ? WHERE id = ?`;
        await safeDbUpdate(updateOrderSql, [total, currentOrderId]);

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
        loadTableOrders();
    } catch (error) {
        console.error("Error updating order:", error);
        alert("Error updating order: " + error.message);
    }
}

// Mark order as complete
async function markOrderComplete() {
    if (!currentOrderId || !(window.dbBackend || dbBackend)) {
        alert("Invalid order or database not initialized");
        return;
    }

    const sure = await showConfirmModal("Are you sure you want to mark this order as complete?");
    if (!sure) return;

    try {
        const orderSql = `SELECT total FROM orders WHERE id = ?`;
        const orders = await safeDbQuery(orderSql, [currentOrderId]);
        if (!orders || orders.length === 0) {
            alert("Order not found");
            return;
        }
        const orderTotal = orders[0].total;

        const updateOrderSql = `UPDATE orders SET order_status = 'completed', payment_status = 'paid' WHERE id = ?`;
        await safeDbUpdate(updateOrderSql, [currentOrderId]);

        const now = new Date().toISOString();
        const paymentSql = `INSERT INTO payment_transactions (order_id, amount, payment_method, payment_status, created_at) VALUES (?, ?, ?, ?, ?)`;
        await safeDbUpdate(paymentSql, [currentOrderId, orderTotal, 'cash', 'completed', now]);

        // Always ask: thermal receipt (same as place order)
        const wantPrint = await showConfirmModal("Order marked as complete! Would you like to print the receipt? (You can print more copies anytime.)");
        if (wantPrint) {
            try {
                if (typeof printOrderReceipt === 'function') {
                    await printOrderReceipt(currentOrderId, dbBackend);
                } else {
                    const script = document.createElement('script');
                    script.src = 'js/print_utils.js';
                    script.onload = async () => {
                        if (typeof printOrderReceipt === 'function') {
                            await printOrderReceipt(currentOrderId, dbBackend);
                        } else alert("Error: Print function not available");
                    };
                    script.onerror = () => alert("Error loading print utilities");
                    document.head.appendChild(script);
                }
            } catch (error) {
                console.error("[TABLE] Error printing receipt:", error);
                alert("Error printing receipt: " + error.message);
            }
        }

        closeOrderModal();
        loadTableOrders();
    } catch (error) {
        console.error("Error completing order:", error);
        alert("Error completing order: " + error.message);
    }
}

// Close modal
function closeOrderModal() {
    const modal = document.getElementById("orderModal");
    if (modal) {
        modal.style.display = "none";
    }
    selectedItems = {};
    currentTableNumber = null;
    currentOrderId = null;
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById("orderModal");
    if (event.target === modal) {
        closeOrderModal();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    waitForWebChannel();
    window.addEventListener('webchannel-ready', () => {
        if (window.dbBackend) {
            dbBackend = window.dbBackend;
            if (!menuItems || menuItems.length === 0) loadMenuItems();
            loadTableOrders();
        }
    });
});
