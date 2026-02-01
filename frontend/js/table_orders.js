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
            loadTableOrdersTable();
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
        SELECT o.id, o.total, o.created_at, o.table_number, o.order_status, o.discount_percentage, o.order_note, o.amount_received, o.balance_return
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
                <div class="discount-section" style="margin: 15px 0;">
                    <label for="discountInput" style="color: white; display: block; margin-bottom: 5px; font-size: 14px;">Discount (%):</label>
                    <input type="number" id="discountInput" min="0" max="100" step="0.01" value="0" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background-color: #2a2a2a; color: white; font-size: 14px;" oninput="updateOrderSummary()">
                </div>
                <div class="note-section" style="margin: 15px 0;">
                    <label for="orderNoteInput" style="color: white; display: block; margin-bottom: 5px; font-size: 14px;">Order Note:</label>
                    <textarea id="orderNoteInput" placeholder="Enter order note (optional)" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background-color: #2a2a2a; color: white; font-size: 14px; resize: vertical; min-height: 60px; font-family: inherit;"></textarea>
                </div>
                <div class="order-total">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #aaa;">Subtotal:</span>
                        <span style="color: #aaa;" id="subtotalAmount">Rs. 0.00</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;" id="discountRow" style="display: none;">
                        <span style="color: #aaa;">Discount:</span>
                        <span style="color: #4caf50;" id="discountAmount">Rs. 0.00</span>
                    </div>
                    <strong>Total: <span id="orderTotal">Rs. 0.00</span></strong>
                </div>
                <div class="payment-received-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #444;">
                    <label for="amountReceivedInput" style="color: white; display: block; margin-bottom: 6px; font-size: 14px;">Amount received (Rs.):</label>
                    <input type="number" id="amountReceivedInput" min="0" step="0.01" placeholder="0" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background-color: #2a2a2a; color: white; font-size: 14px;" oninput="updatePaymentBalance()">
                    <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 15px;">
                        <span style="color: #aaa;">Balance to return:</span>
                        <strong id="balanceReturn" style="color: #4caf50;">Rs. 0.00</strong>
                    </div>
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

    const orderStatus = order.order_status || 'pending';
    const statusClass = orderStatus === 'completed' ? 'status-completed' : (orderStatus === 'cancelled' ? 'status-cancelled' : 'status-pending');
    const statusText = orderStatus === 'completed' ? 'Completed' : (orderStatus === 'cancelled' ? 'Cancelled' : 'Pending');
    const canCancel = orderStatus !== 'completed' && orderStatus !== 'cancelled';

    modalTitle.textContent = `Table ${tableNumber} - Order #${order.id}`;
    modalContent.innerHTML = `
        <div class="order-details-section" style="margin-bottom: 20px;">
            <div class="order-info">
                <p><strong>Order ID:</strong> #${order.id}</p>
                <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                <p><strong>Status:</strong> <span class="${statusClass}">${statusText}</span></p>
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
                <div class="discount-section" style="margin: 15px 0;">
                    <label for="discountInput" style="color: white; display: block; margin-bottom: 5px; font-size: 14px;">Discount (%):</label>
                    <input type="number" id="discountInput" min="0" max="100" step="0.01" value="${order.discount_percentage || 0}" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background-color: #2a2a2a; color: white; font-size: 14px;" oninput="updateOrderSummary()">
                </div>
                <div class="note-section" style="margin: 15px 0;">
                    <label for="orderNoteInput" style="color: white; display: block; margin-bottom: 5px; font-size: 14px;">Order Note:</label>
                    <textarea id="orderNoteInput" placeholder="Enter order note (optional)" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background-color: #2a2a2a; color: white; font-size: 14px; resize: vertical; min-height: 60px; font-family: inherit;">${order.order_note || ''}</textarea>
                </div>
                <div class="order-total">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #aaa;">Subtotal:</span>
                        <span style="color: #aaa;" id="subtotalAmount">Rs. 0.00</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;" id="discountRow" style="display: none;">
                        <span style="color: #aaa;">Discount:</span>
                        <span style="color: #4caf50;" id="discountAmount">Rs. 0.00</span>
                    </div>
                    <strong>Total: <span id="orderTotal">Rs. ${parseFloat(order.total).toFixed(2)}</span></strong>
                </div>
                <div class="payment-received-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #444;">
                    <label for="amountReceivedInput" style="color: white; display: block; margin-bottom: 6px; font-size: 14px;">Amount received (Rs.):</label>
                    <input type="number" id="amountReceivedInput" min="0" step="0.01" placeholder="0" value="${(order.amount_received != null && order.amount_received !== '' && !isNaN(parseFloat(order.amount_received))) ? parseFloat(order.amount_received) : ''}" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background-color: #2a2a2a; color: white; font-size: 14px;" oninput="updatePaymentBalance()">
                    <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 15px;">
                        <span style="color: #aaa;">Balance to return:</span>
                        <strong id="balanceReturn" style="color: #4caf50;">Rs. 0.00</strong>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="closeOrderModal()">Close</button>
                    ${canCancel ? `<button class="btn-warning" onclick="updateOrder()">Update Order</button>` : ''}
                    ${canCancel ? `<button class="btn-danger" onclick="cancelOrder(${order.id})" style="background-color: #f44336; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; margin-right: 5px;" title="Cancel Order">✕ Cancel</button>` : ''}
                    ${canCancel ? `<button class="btn-success" onclick="markOrderComplete()">Mark Complete</button>` : ''}
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
window.cancelOrder = cancelOrder;
window.openTableOrderFromTable = openTableOrderFromTable;

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
    const subtotalEl = document.getElementById("subtotalAmount");
    const discountInput = document.getElementById("discountInput");
    const discountAmountEl = document.getElementById("discountAmount");
    const discountRow = document.getElementById("discountRow");
    const orderTotal = document.getElementById("orderTotal");

    if (!selectedItemsList) return;

    if (Object.keys(selectedItems).length === 0) {
        selectedItemsList.innerHTML = '<p class="empty-message">No items selected</p>';
        if (subtotalEl) subtotalEl.textContent = 'Rs. 0.00';
        if (discountAmountEl) discountAmountEl.textContent = 'Rs. 0.00';
        if (discountRow) discountRow.style.display = 'none';
        if (orderTotal) orderTotal.textContent = 'Rs. 0.00';
        updatePaymentBalance();
        return;
    }

    let subtotal = 0;
    selectedItemsList.innerHTML = Object.values(selectedItems).map(item => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
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

    // Get discount percentage
    const discountPercent = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const total = subtotal - discountAmount;

    // Update display
    if (subtotalEl) subtotalEl.textContent = `Rs. ${subtotal.toFixed(2)}`;
    if (discountAmountEl) discountAmountEl.textContent = `-Rs. ${discountAmount.toFixed(2)}`;
    if (discountRow) discountRow.style.display = discountPercent > 0 ? 'flex' : 'none';
    if (orderTotal) orderTotal.textContent = `Rs. ${total.toFixed(2)}`;
    updatePaymentBalance();
}

// Update balance to return when amount received or order total changes
function updatePaymentBalance() {
    const orderTotalEl = document.getElementById("orderTotal");
    const amountReceivedInput = document.getElementById("amountReceivedInput");
    const balanceReturnEl = document.getElementById("balanceReturn");
    if (!orderTotalEl || !amountReceivedInput || !balanceReturnEl) return;
    // Strip "Rs." prefix first so "Rs. 1120.00" doesn't become ".112000" (0.112)
    const totalText = (orderTotalEl.textContent || "0").replace(/^Rs\.?\s*/i, "").replace(/,/g, "").trim();
    const total = parseFloat(totalText) || 0;
    const received = parseFloat(amountReceivedInput.value) || 0;
    const balance = received - total;
    if (balance >= 0) {
        balanceReturnEl.textContent = `Rs. ${balance.toFixed(2)}`;
        balanceReturnEl.style.color = "#4caf50";
    } else {
        balanceReturnEl.textContent = `Short by Rs. ${Math.abs(balance).toFixed(2)}`;
        balanceReturnEl.style.color = "#f44336";
    }
}
window.updatePaymentBalance = updatePaymentBalance;

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
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Please select at least one item");
        } else {
            alert("Please select at least one item");
        }
        return;
    }

    if (!(window.dbBackend || dbBackend)) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Database not initialized");
        } else {
            alert("Database not initialized");
        }
        return;
    }

    // Check if table already has an active (pending) order
    const checkTableSql = `SELECT id FROM orders WHERE order_type = 'Table' AND table_number = ? AND (order_status IS NULL OR order_status = 'pending')`;
    const existingOrder = await safeDbQuery(checkTableSql, [currentTableNumber]);

    if (existingOrder && existingOrder.length > 0) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal(`Table ${currentTableNumber} already has an active order. Please complete or update the existing order first.`);
        } else {
            alert(`Table ${currentTableNumber} already has an active order. Please complete or update the existing order first.`);
        }
        return;
    }

    try {
        // Calculate subtotal
        const subtotal = Object.values(selectedItems).reduce((sum, item) => {
            return sum + (item.price * item.qty);
        }, 0);

        // Get discount
        const discountInput = document.getElementById("discountInput");
        const discountPercent = discountInput ? parseFloat(discountInput.value) || 0 : 0;
        const discountAmount = (subtotal * discountPercent) / 100;
        const total = subtotal - discountAmount;

        // Get order note
        const orderNoteInput = document.getElementById("orderNoteInput");
        const orderNote = orderNoteInput ? orderNoteInput.value.trim() : '';
        // Amount received and balance to return (for receipt)
        const amountReceivedInput = document.getElementById("amountReceivedInput");
        const amountReceived = amountReceivedInput ? parseFloat(amountReceivedInput.value) : null;
        const amountReceivedVal = (amountReceived != null && !isNaN(amountReceived) && amountReceived > 0) ? amountReceived : null;
        const balanceReturnVal = amountReceivedVal != null ? (amountReceivedVal - total) : null;

        // Insert order with table number
        const now = new Date().toISOString();
        const insertOrderSql = `INSERT INTO orders (order_type, total, discount_percentage, created_at, table_number, order_status, payment_status, order_note, amount_received, balance_return) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const result = await safeDbUpdate(insertOrderSql, ['Table', total, discountPercent, now, currentTableNumber, 'pending', 'pending', orderNote, amountReceivedVal, balanceReturnVal]);

        console.log("Order insert result:", result);
        console.log("Result type:", typeof result);
        console.log("Result keys:", result ? Object.keys(result) : "null");

        if (!result || result.success === false) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Error saving order: " + (result?.error || "Unknown error"));
            } else {
                alert("Error saving order: " + (result?.error || "Unknown error"));
            }
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
                                    } else {
                                        if (typeof showAlertModal === 'function') {
                                            await showAlertModal("Error: Print function not available");
                                        } else {
                                            alert("Error: Print function not available");
                                        }
                                    }
                                };
                                script.onerror = async () => {
                                    if (typeof showAlertModal === 'function') {
                                        await showAlertModal("Error loading print utilities");
                                    } else {
                                        alert("Error loading print utilities");
                                    }
                                };
                                document.head.appendChild(script);
                            }
                        } catch (e) {
                            console.error("[TABLE] Error printing receipt:", e);
                            if (typeof showAlertModal === 'function') {
                                await showAlertModal("Error printing receipt: " + e.message);
                            } else {
                                alert("Error printing receipt: " + e.message);
                            }
                        }
                    }
                    closeOrderModal();
                    loadTableOrders();
                    loadTableOrdersTable();
                    return;
                }
            }
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Error getting order ID. Please check console for details.");
            } else {
                alert("Error getting order ID. Please check console for details.");
            }
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
                        } else {
                            if (typeof showAlertModal === 'function') {
                                await showAlertModal("Error: Print function not available");
                            } else {
                                alert("Error: Print function not available");
                            }
                        }
                    };
                    script.onerror = async () => {
                        if (typeof showAlertModal === 'function') {
                            await showAlertModal("Error loading print utilities");
                        } else {
                            alert("Error loading print utilities");
                        }
                    };
                    document.head.appendChild(script);
                }
            } catch (error) {
                console.error("[TABLE] Error printing receipt:", error);
                if (typeof showAlertModal === 'function') {
                    await showAlertModal("Error printing receipt: " + error.message);
                } else {
                    alert("Error printing receipt: " + error.message);
                }
            }
        }

        closeOrderModal();
        loadTableOrders();
        loadTableOrdersTable();

    } catch (error) {
        console.error("Error saving order:", error);
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Error saving order: " + error.message);
        } else {
            alert("Error saving order: " + error.message);
        }
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
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Please select at least one item");
        } else {
            alert("Please select at least one item");
        }
        return;
    }

    if (!currentOrderId || !(window.dbBackend || dbBackend)) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Invalid order or database not initialized");
        } else {
            alert("Invalid order or database not initialized");
        }
        return;
    }

    try {
        // Calculate subtotal
        const subtotal = Object.values(selectedItems).reduce((sum, item) => {
            return sum + (item.price * item.qty);
        }, 0);

        // Get discount
        const discountInput = document.getElementById("discountInput");
        const discountPercent = discountInput ? parseFloat(discountInput.value) || 0 : 0;
        const discountAmount = (subtotal * discountPercent) / 100;
        const total = subtotal - discountAmount;

        // Get order note
        const orderNoteInput = document.getElementById("orderNoteInput");
        const orderNote = orderNoteInput ? orderNoteInput.value.trim() : '';
        // Amount received and balance to return (for receipt)
        const amountReceivedInput = document.getElementById("amountReceivedInput");
        const amountReceived = amountReceivedInput ? parseFloat(amountReceivedInput.value) : null;
        const amountReceivedVal = (amountReceived != null && !isNaN(amountReceived) && amountReceived > 0) ? amountReceived : null;
        const balanceReturnVal = amountReceivedVal != null ? (amountReceivedVal - total) : null;

        // Update order total, note, and payment fields
        const updateOrderSql = `UPDATE orders SET total = ?, discount_percentage = ?, order_note = ?, amount_received = ?, balance_return = ? WHERE id = ?`;
        await safeDbUpdate(updateOrderSql, [total, discountPercent, orderNote, amountReceivedVal, balanceReturnVal, currentOrderId]);

        // Delete existing order items
        const deleteItemsSql = `DELETE FROM order_items WHERE order_id = ?`;
        await safeDbUpdate(deleteItemsSql, [currentOrderId]);

        // Insert new order items
        for (const item of Object.values(selectedItems)) {
            const insertItemSql = `INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)`;
            await safeDbUpdate(insertItemSql, [currentOrderId, item.id, item.qty, item.price]);
        }

        if (typeof showAlertModal === 'function') {
            await showAlertModal("Order updated successfully!");
        } else {
            alert("Order updated successfully!");
        }
        closeOrderModal();
        loadTableOrders();
        loadTableOrdersTable();
    } catch (error) {
        console.error("Error updating order:", error);
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Error updating order: " + error.message);
        } else {
            alert("Error updating order: " + error.message);
        }
    }
}

// Mark order as complete
async function markOrderComplete() {
    if (!currentOrderId || !(window.dbBackend || dbBackend)) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Invalid order or database not initialized");
        } else {
            alert("Invalid order or database not initialized");
        }
        return;
    }

    const sure = await showConfirmModal("Are you sure you want to mark this order as complete?");
    if (!sure) return;

    try {
        const orderSql = `SELECT total FROM orders WHERE id = ?`;
        const orders = await safeDbQuery(orderSql, [currentOrderId]);
        if (!orders || orders.length === 0) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Order not found");
            } else {
                alert("Order not found");
            }
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
                        } else {
                            if (typeof showAlertModal === 'function') {
                                await showAlertModal("Error: Print function not available");
                            } else {
                                alert("Error: Print function not available");
                            }
                        }
                    };
                    script.onerror = async () => {
                        if (typeof showAlertModal === 'function') {
                            await showAlertModal("Error loading print utilities");
                        } else {
                            alert("Error loading print utilities");
                        }
                    };
                    document.head.appendChild(script);
                }
            } catch (error) {
                console.error("[TABLE] Error printing receipt:", error);
                if (typeof showAlertModal === 'function') {
                    await showAlertModal("Error printing receipt: " + error.message);
                } else {
                    alert("Error printing receipt: " + error.message);
                }
            }
        }

        closeOrderModal();
        loadTableOrders();
        loadTableOrdersTable();
    } catch (error) {
        console.error("Error completing order:", error);
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Error completing order: " + error.message);
        } else {
            alert("Error completing order: " + error.message);
        }
    }
}

// Helper function to open order modal from table
async function openTableOrderFromTable(orderId) {
    if (!(window.dbBackend || dbBackend)) {
        console.error("Database backend not initialized");
        return;
    }

    try {
        const orderSql = `SELECT * FROM orders WHERE id = ?`;
        const orders = await safeDbQuery(orderSql, [orderId]);
        
        if (!orders || orders.length === 0) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Order not found");
            } else {
                alert("Order not found");
            }
            return;
        }

        const order = orders[0];
        await openOrderModal(order.table_number, order);
    } catch (error) {
        console.error("Error opening order:", error);
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Error opening order: " + error.message);
        } else {
            alert("Error opening order: " + error.message);
        }
    }
}

// Close modal
// Cancel order function
async function cancelOrder(orderId) {
    if (!orderId || !(window.dbBackend || dbBackend)) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Invalid order or database not initialized");
        } else {
            alert("Invalid order or database not initialized");
        }
        return;
    }

    const confirmed = await showConfirmModal("Are you sure you want to cancel this order? This action cannot be undone.");
    if (!confirmed) return;

    try {
        const updateStatusSql = `UPDATE orders SET order_status = 'cancelled', payment_status = 'cancelled' WHERE id = ?`;
        await safeDbUpdate(updateStatusSql, [orderId]);

        if (typeof showAlertModal === 'function') {
            await showAlertModal("Order cancelled successfully!");
        } else {
            alert("Order cancelled successfully!");
        }

        // Close modal and reload table orders
        closeOrderModal();
        loadTableOrders();
        loadTableOrdersTable();
    } catch (error) {
        console.error("Error cancelling order:", error);
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Error cancelling order: " + error.message);
        } else {
            alert("Error cancelling order: " + error.message);
        }
    }
}

// Load all table orders into the table view
async function loadTableOrdersTable() {
    if (!(window.dbBackend || dbBackend)) {
        console.error("Database backend not initialized");
        return;
    }

    try {
        const sql = `
            SELECT id, table_number, total, created_at, order_status, payment_status
            FROM orders
            WHERE order_type = 'Table'
            ORDER BY created_at DESC
        `;
        const orders = await safeDbQuery(sql);

        const tbody = document.getElementById("tableOrdersTableBody");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (!orders || orders.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = '<td colspan="7" style="text-align: center; color: white; padding: 20px;">No table orders found</td>';
            tbody.appendChild(tr);
            return;
        }

        orders.forEach(order => {
            const tr = document.createElement("tr");
            tr.style.backgroundColor = "white";
            const date = new Date(order.created_at);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const status = order.order_status || 'pending';
            let statusClass = 'status-pending';
            let statusText = 'Pending';
            if (status === 'completed') {
                statusClass = 'status-completed';
                statusText = 'Completed';
            } else if (status === 'cancelled') {
                statusClass = 'status-cancelled';
                statusText = 'Cancelled';
            }

            const paymentStatus = order.payment_status || 'pending';
            let paymentStatusClass = 'status-pending';
            let paymentStatusText = 'Pending';
            if (paymentStatus === 'paid') {
                paymentStatusClass = 'status-completed';
                paymentStatusText = 'Paid';
            } else if (paymentStatus === 'cancelled') {
                paymentStatusClass = 'status-cancelled';
                paymentStatusText = 'Cancelled';
            }

            // Only show edit button if order is not completed or cancelled
            const canEdit = status !== 'completed' && status !== 'cancelled';
            const canCancel = status !== 'completed' && status !== 'cancelled';

            tr.innerHTML = `
                <td>#${order.id}</td>
                <td>Table ${order.table_number || '-'}</td>
                <td>${dateStr} ${timeStr}</td>
                <td>Rs. ${parseFloat(order.total || 0).toFixed(2)}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td><span class="${paymentStatusClass}">${paymentStatusText}</span></td>
                <td>
                    ${canEdit ? `<button class="btn-warning" onclick="openTableOrderFromTable(${order.id})" style="padding: 5px 10px; font-size: 12px; margin-right: 5px;">Edit</button>` : ''}
                    ${canCancel ? `<button class="btn-danger" onclick="cancelOrder(${order.id})" style="padding: 5px 10px; font-size: 12px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Cancel Order">✕</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading table orders:", error);
        const tbody = document.getElementById("tableOrdersTableBody");
        if (tbody) {
            tbody.innerHTML = '<td colspan="7" style="text-align: center; color: #ff6b6b; padding: 20px;">Error loading orders</td>';
        }
    }
}

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
            loadTableOrdersTable();
        }
    });
});
