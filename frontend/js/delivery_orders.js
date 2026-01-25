let dbBackend = null;
let menuItems = [];
let selectedItems = {};
let currentOrderId = null;
let filteredMenuItems = [];

let menuItemsContainer, totalAmountEl, menuSearchInput, customerNameInput, customerPhoneInput;

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
            // Use parameterized query
            const paramsJson = JSON.stringify(params);
            response = backend.execute_with_params(sql, paramsJson);
        } else {
            // Use direct query
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
        console.log("[DELIVERY] WebChannel ready, loading data...");
        setTimeout(() => {
            loadMenuItems();
            loadDeliveryOrders();
        }, 100);
    } else {
        console.log("[DELIVERY] Waiting for WebChannel...");
        setTimeout(waitForWebChannel, 100);
    }
}

// Load menu items from database
async function loadMenuItems() {
    if (!(window.dbBackend || dbBackend)) {
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
            renderMenu([]);
            return;
        }

        menuItems = items;
        console.log("Loaded menu items:", menuItems.length);
        renderMenu(menuItems);
    } catch (error) {
        console.error("Error loading menu items:", error);
        console.error("Error details:", error.message, error.stack);
        menuItems = [];
        renderMenu([]);
    }
}

function renderMenu(items) {
    if (!menuItemsContainer) return;
    menuItemsContainer.innerHTML = "";

    if (!items || items.length === 0) {
        menuItemsContainer.innerHTML = '<p class="empty-message">No menu items available</p>';
        return;
    }

    items.forEach(item => {
        if (!item || !item.id) {
            console.warn("Invalid menu item:", item);
            return;
        }

        const isSelected = selectedItems[item.id] ? true : false;
        const div = document.createElement("div");
        div.classList.add("menu-item-card");
        if (isSelected) {
            div.classList.add("selected");
        }
        div.innerHTML = `
            <div class="menu-item-name">${item.name || 'Unknown Item'}</div>
            <div class="menu-item-category">${item.category || 'Uncategorized'}</div>
            <div class="menu-item-price">Rs. ${parseFloat(item.price || 0).toFixed(2)}</div>
            ${isSelected ? `<div class="menu-item-qty">Qty: ${selectedItems[item.id].qty || 0}</div>` : ''}
        `;
        div.addEventListener("click", () => addItem(item));
        menuItemsContainer.appendChild(div);
    });
}

function addItem(item) {
    if (selectedItems[item.id]) {
        selectedItems[item.id].qty += 1;
    } else {
        selectedItems[item.id] = { ...item, qty: 1 };
    }
    renderSelectedItems();
    // Re-render menu to show updated quantities
    const searchTerm = menuSearchInput ? menuSearchInput.value.toLowerCase().trim() : '';
    if (searchTerm === '') {
        renderMenu(menuItems);
    } else {
        const filtered = menuItems.filter(item =>
            item.name.toLowerCase().includes(searchTerm) ||
            (item.category && item.category.toLowerCase().includes(searchTerm))
        );
        renderMenu(filtered);
    }
}

function removeItem(id) {
    delete selectedItems[id];
    renderSelectedItems();
    // Re-render menu to remove selected state
    const searchTerm = menuSearchInput ? menuSearchInput.value.toLowerCase().trim() : '';
    if (searchTerm === '') {
        renderMenu(menuItems);
    } else {
        const filtered = menuItems.filter(item =>
            item.name.toLowerCase().includes(searchTerm) ||
            (item.category && item.category.toLowerCase().includes(searchTerm))
        );
        renderMenu(filtered);
    }
}

function renderSelectedItems() {
    const selectedItemsList = document.getElementById("selectedItemsList");
    const totalAmountEl = document.getElementById("totalAmount");

    if (!selectedItemsList) return;

    if (Object.keys(selectedItems).length === 0) {
        selectedItemsList.innerHTML = '<p class="empty-message">No items selected</p>';
        if (totalAmountEl) totalAmountEl.textContent = '0.00';
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
                    <button class="btn-qty" onclick="decreaseQuantity(${itemId})">-</button>
                    <span class="item-qty">${item.qty || 0}</span>
                    <button class="btn-qty" onclick="increaseQuantity(${itemId})">+</button>
                    <button class="btn-remove" onclick="removeItem(${itemId})">×</button>
                </div>
            </div>
        `;
    }).join('');

    if (totalAmountEl) totalAmountEl.textContent = total.toFixed(2);
}

// Quantity controls
function increaseQuantity(menuItemId) {
    if (selectedItems[menuItemId]) {
        selectedItems[menuItemId].qty += 1;
        renderSelectedItems();
        renderMenu(menuItems.filter(item => {
            const searchTerm = menuSearchInput ? menuSearchInput.value.toLowerCase().trim() : '';
            if (searchTerm === '') return true;
            return item.name.toLowerCase().includes(searchTerm) ||
                (item.category && item.category.toLowerCase().includes(searchTerm));
        }));
    }
}

function decreaseQuantity(menuItemId) {
    if (selectedItems[menuItemId]) {
        selectedItems[menuItemId].qty -= 1;
        if (selectedItems[menuItemId].qty <= 0) {
            removeItem(menuItemId);
        } else {
            renderSelectedItems();
            renderMenu(menuItems.filter(item => {
                const searchTerm = menuSearchInput ? menuSearchInput.value.toLowerCase().trim() : '';
                if (searchTerm === '') return true;
                return item.name.toLowerCase().includes(searchTerm) ||
                    (item.category && item.category.toLowerCase().includes(searchTerm));
            }));
        }
    }
}

// Save order
async function saveOrder(orderType, total) {
    if (!(window.dbBackend || dbBackend)) {
        alert("Database not initialized");
        return;
    }

    try {
        const customerName = customerNameInput ? customerNameInput.value.trim() : '';
        const now = new Date().toISOString();
        const insertOrderSql = `INSERT INTO orders (order_type, total, created_at, customer_name, customer_phone, order_status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const customerPhone = customerPhoneInput ? customerPhoneInput.value.trim() : '';
        const result = await safeDbUpdate(insertOrderSql, [orderType, total, now, customerName, customerPhone, 'pending', 'pending']);

        console.log("Order insert result:", result);

        if (!result || result.success === false) {
            alert("Error saving order: " + (result?.error || "Unknown error"));
            return;
        }

        // Get order id from backend response - try multiple possible keys
        let orderId = parseInt(result.last_insert_id || result.lastInsertId || result.id || 0);

        console.log("Order ID from result:", orderId);
        console.log("Full result:", JSON.stringify(result));

        if (isNaN(orderId) || orderId <= 0) {
            console.error("Invalid order ID:", orderId, "Full result:", JSON.stringify(result));
            // Try fallback: query for the last inserted order
            const lastOrderSql = "SELECT id FROM orders ORDER BY id DESC LIMIT 1";
            const lastOrder = await safeDbQuery(lastOrderSql);
            if (lastOrder && lastOrder.length > 0) {
                const fallbackOrderId = parseInt(lastOrder[0].id);
                console.log("Using fallback order ID:", fallbackOrderId);
                if (!isNaN(fallbackOrderId) && fallbackOrderId > 0) {
                    orderId = fallbackOrderId;
                } else {
                    alert("Error getting order ID. Please check console for details.");
                    return;
                }
            } else {
                alert("Error getting order ID. Please check console for details.");
                return;
            }
        }

        // Insert order items
        await insertOrderItems(orderId);

        const wantPrint = await showConfirmModal("Order placed successfully! Would you like to print the receipt?");
        if (wantPrint) {
            try {
                if (typeof printOrderReceipt === 'function') {
                    await printOrderReceipt(orderId, dbBackend);
                } else {
                    const script = document.createElement('script');
                    script.src = 'js/print_utils.js';
                    script.onload = async () => {
                        if (typeof printOrderReceipt === 'function') {
                            await printOrderReceipt(orderId, dbBackend);
                        } else alert("Error: Print function not available");
                    };
                    script.onerror = () => alert("Error loading print utilities");
                    document.head.appendChild(script);
                }
            } catch (error) {
                console.error("[DELIVERY] Error printing receipt:", error);
                alert("Error printing receipt: " + error.message);
            }
        }

        // Reset order
        selectedItems = {};
        renderSelectedItems();
        if (customerNameInput) customerNameInput.value = "";
        if (customerPhoneInput) customerPhoneInput.value = "";
        // Reload delivery orders table
        loadDeliveryOrders();
    } catch (error) {
        console.error("Error saving order:", error);
        alert("Error saving order: " + error.message);
    }
}

// Helper function to insert order items
async function insertOrderItems(orderId) {
    for (const item of Object.values(selectedItems)) {
        const insertItemSql = `INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)`;
        const itemResult = await safeDbUpdate(insertItemSql, [orderId, item.id, item.qty, item.price]);

        if (!itemResult || itemResult.success === false) {
            console.error("Error inserting order item:", itemResult);
            throw new Error("Failed to insert order item: " + (itemResult?.error || "Unknown error"));
        }
    }
}

// Load and display delivery orders in the table
async function loadDeliveryOrders() {
    if (!(window.dbBackend || dbBackend)) {
        console.error("Database backend not initialized");
        return;
    }

    try {
        const sql = `
            SELECT id, customer_name, customer_phone, total, created_at, order_status, payment_status
            FROM orders
            WHERE order_type = 'Delivery'
            ORDER BY created_at DESC
        `;
        const orders = await safeDbQuery(sql);

        const tbody = document.getElementById("deliveryOrdersTableBody");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (!orders || orders.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = '<td colspan="7" style="text-align: center; color: white; padding: 20px;">No delivery orders found</td>';
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
            const statusClass = status === 'completed' ? 'status-completed' : 'status-pending';
            const statusText = status === 'completed' ? 'Completed' : 'Pending';

            tr.innerHTML = `
                <td>#${order.id}</td>
                <td>${order.customer_name || '-'}</td>
                <td>${order.customer_phone || '-'}</td>
                <td>${dateStr} ${timeStr}</td>
                <td>Rs. ${parseFloat(order.total || 0).toFixed(2)}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn-warning" onclick="openEditOrderModal(${order.id})" style="padding: 5px 10px; font-size: 12px;">Edit</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading delivery orders:", error);
        const tbody = document.getElementById("deliveryOrdersTableBody");
        if (tbody) {
            tbody.innerHTML = '<td colspan="7" style="text-align: center; color: #ff6b6b; padding: 20px;">Error loading orders</td>';
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    menuItemsContainer = document.getElementById("menuItems");
    totalAmountEl = document.getElementById("totalAmount");
    const placeOrderBtn = document.getElementById("placeOrderBtn");
    menuSearchInput = document.getElementById("menuSearch");
    customerNameInput = document.getElementById("customerName");
    customerPhoneInput = document.getElementById("customerPhone");

    // Make functions global for inline buttons
    window.removeItem = removeItem;
    window.increaseQuantity = increaseQuantity;
    window.decreaseQuantity = decreaseQuantity;

    // Menu search filter
    if (menuSearchInput) {
        menuSearchInput.addEventListener("input", () => {
            const searchTerm = menuSearchInput.value.toLowerCase().trim();
            if (searchTerm === '') {
                renderMenu(menuItems);
            } else {
                const filtered = menuItems.filter(item =>
                    item.name.toLowerCase().includes(searchTerm) ||
                    (item.category && item.category.toLowerCase().includes(searchTerm))
                );
                renderMenu(filtered);
            }
        });
    }

    // Place order
    placeOrderBtn.addEventListener("click", async () => {
        if (!(window.dbBackend || dbBackend)) {
            alert("Database backend not initialized. Please wait...");
            return;
        }

        const customerName = customerNameInput.value.trim();
        const customerPhone = customerPhoneInput.value.trim();

        if (!customerName) {
            alert("Please enter customer name");
            return;
        }

        if (!customerPhone) {
            alert("Please enter phone number");
            return;
        }

        if (Object.keys(selectedItems).length === 0) {
            alert("Please select at least one item");
            return;
        }

        // Calculate total
        let total = 0;
        Object.values(selectedItems).forEach(item => {
            total += parseFloat(item.price) * item.qty;
        });

        let orderSummary = `Customer: ${customerName}\nPhone: ${customerPhone}\n\n`;
        Object.values(selectedItems).forEach(item => {
            const itemTotal = parseFloat(item.price) * item.qty;
            orderSummary += `${item.name} x${item.qty} = Rs. ${itemTotal.toFixed(2)}\n`;
        });
        orderSummary += `\nTotal: Rs. ${total.toFixed(2)}`;

        const confirmed = await showConfirmModal(orderSummary + "\n\nConfirm order?");
        if (confirmed) await saveOrder("Delivery", total);
    });

    waitForWebChannel();
    window.addEventListener('webchannel-ready', () => {
        if (window.dbBackend) {
            dbBackend = window.dbBackend;
            if (!menuItems || menuItems.length === 0) loadMenuItems();
            loadDeliveryOrders();
        }
    });
});

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

    modalTitle.textContent = `Edit Delivery Order #${order.id}`;
    modalTitle.style.color = "white";
    modalContent.innerHTML = `
        <div class="order-modal-body">
            <div class="order-details-section">
                <div class="order-info">
                    <p><strong>Order ID:</strong> #${order.id}</p>
                    <p><strong>Customer Name:</strong> <input type="text" id="editCustomerName" value="${order.customer_name || ''}" style="padding: 5px; width: 200px; border-radius: 4px; border: 1px solid #2A2A2A; background-color: white; color: black;"></p>
                    <p><strong>Phone Number:</strong> <input type="text" id="editCustomerPhone" value="${order.customer_phone || ''}" style="padding: 5px; width: 200px; border-radius: 4px; border: 1px solid #2A2A2A; background-color: white; color: black;"></p>
                    <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                    <p><strong>Order Status:</strong> <span class="${order.order_status === 'completed' ? 'status-completed' : 'status-pending'}">${order.order_status === 'completed' ? 'Completed' : 'Pending'}</span></p>
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
                    <h3>Order Summary</h3>
                    <div id="selectedItemsListModal" class="selected-items-list"></div>
                    <div class="order-total">
                        <strong>Total: <span id="orderTotal">Rs. ${parseFloat(order.total || 0).toFixed(2)}</span></strong>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary" onclick="closeOrderModal()">Close</button>
                        <button class="btn-warning" onclick="updateOrder()">Update Order</button>
                        <button class="btn-success" onclick="markOrderComplete()">Mark Complete</button>
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
        const customerName = editCustomerNameInput ? editCustomerNameInput.value.trim() : '';
        const customerPhone = editCustomerPhoneInput ? editCustomerPhoneInput.value.trim() : '';

        // Calculate new total
        const total = Object.values(selectedItems).reduce((sum, item) => {
            return sum + (item.price * item.qty);
        }, 0);

        // Update order
        const updateOrderSql = `UPDATE orders SET total = ?, customer_name = ?, customer_phone = ? WHERE id = ?`;
        await safeDbUpdate(updateOrderSql, [total, customerName, customerPhone, currentOrderId]);

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
        loadDeliveryOrders();
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

    const sure = typeof showConfirmModal === 'function'
        ? await showConfirmModal("Are you sure you want to mark this order as complete?")
        : confirm("Are you sure you want to mark this order as complete?");
    if (!sure) return;

    try {
        const orderSql = `SELECT total FROM orders WHERE id = ?`;
        const orders = await safeDbQuery(orderSql, [currentOrderId]);
        if (!orders || orders.length === 0) {
            alert("Order not found");
            return;
        }
        const orderTotal = orders[0].total;

        const updateStatusSql = `UPDATE orders SET order_status = 'completed', payment_status = 'paid' WHERE id = ?`;
        await safeDbUpdate(updateStatusSql, [currentOrderId]);

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
                console.error("[DELIVERY] Error printing receipt:", error);
                alert("Error printing receipt: " + error.message);
            }
        }

        closeOrderModal();
        loadDeliveryOrders();
    } catch (error) {
        console.error("Error marking order complete:", error);
        alert("Error marking order complete: " + error.message);
    }
}

// Make functions global
window.openEditOrderModal = openEditOrderModal;
window.closeOrderModal = closeOrderModal;
window.updateOrder = updateOrder;
window.markOrderComplete = markOrderComplete;
window.filterMenuItems = filterMenuItems;
window.toggleMenuItem = toggleMenuItem;
window.increaseQuantityModal = increaseQuantityModal;
window.decreaseQuantityModal = decreaseQuantityModal;
window.removeItemModal = removeItemModal;
