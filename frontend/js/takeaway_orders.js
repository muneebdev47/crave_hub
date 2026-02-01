// dbBackend is initialized globally by webchannel.js
// Use window.dbBackend or the global dbBackend variable
let menuItems = [];
let selectedItems = {};
let currentOrderId = null;
let filteredMenuItems = [];

let menuItemsContainer, selectedItemsTable, totalAmountEl, menuSearchInput, customerNameInput;

// Helper function to safely execute database queries
async function safeDbQuery(sql, params = null) {
    // Use global dbBackend from webchannel.js or window.dbBackend
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
            response = dbBackend.execute_with_params(sql, paramsJson);
        } else {
            // Use direct query
            response = dbBackend.execute_query(sql);
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

// Wait for global WebChannel to be initialized (from webchannel.js)
function waitForWebChannel() {
    if (window._webChannelInitialized && window.dbBackend) {
        // WebChannel is ready, assign to local variable
        dbBackend = window.dbBackend;
        console.log("[TAKEAWAY] WebChannel ready, loading data...");
        // Wait a bit before loading menu items to ensure backend is ready
        setTimeout(() => {
            loadMenuItems();
            loadTakeawayOrders();
        }, 100);
    } else {
        // Wait for WebChannel initialization
        console.log("[TAKEAWAY] Waiting for WebChannel...");
        setTimeout(waitForWebChannel, 100);
    }
}

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
    if (!selectedItemsList) return;

    if (Object.keys(selectedItems).length === 0) {
        selectedItemsList.innerHTML = '<p class="empty-message">No items selected</p>';
        updateTotalWithDiscount();
        return;
    }

    let subtotal = 0;
    selectedItemsList.innerHTML = Object.values(selectedItems).map(item => {
        const itemTotal = parseFloat(item.price) * item.qty;
        subtotal += itemTotal;
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

    updateTotalWithDiscount();
}

// Update total with discount calculation
function updateTotalWithDiscount() {
    const subtotalEl = document.getElementById("subtotalAmount");
    const discountInput = document.getElementById("discountInput");
    const discountAmountEl = document.getElementById("discountAmount");
    const discountRow = document.getElementById("discountRow");
    const totalAmountEl = document.getElementById("totalAmount");

    // Calculate subtotal
    let subtotal = 0;
    Object.values(selectedItems).forEach(item => {
        subtotal += parseFloat(item.price) * item.qty;
    });

    // Get discount percentage
    const discountPercent = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const total = subtotal - discountAmount;

    // Update display
    if (subtotalEl) subtotalEl.textContent = `Rs. ${subtotal.toFixed(2)}`;
    if (discountAmountEl) discountAmountEl.textContent = `-Rs. ${discountAmount.toFixed(2)}`;
    if (discountRow) discountRow.style.display = discountPercent > 0 ? 'flex' : 'none';
    if (totalAmountEl) totalAmountEl.textContent = total.toFixed(2);
    updateTakeawayPaymentBalance();
}

// Update balance to return when amount received or order total changes (takeaway)
function updateTakeawayPaymentBalance() {
    const totalAmountEl = document.getElementById("totalAmount");
    const amountReceivedInput = document.getElementById("amountReceivedInput");
    const balanceReturnEl = document.getElementById("balanceReturn");
    if (!totalAmountEl || !amountReceivedInput || !balanceReturnEl) return;
    const total = parseFloat(totalAmountEl.textContent) || 0;
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
window.updateTakeawayPaymentBalance = updateTakeawayPaymentBalance;

// Make function globally accessible
window.updateTotalWithDiscount = updateTotalWithDiscount;

// Quantity controls - update total when quantity changes
function increaseQuantity(menuItemId) {
    if (selectedItems[menuItemId]) {
        selectedItems[menuItemId].qty += 1;
        renderSelectedItems();
    }
}

function decreaseQuantity(menuItemId) {
    if (selectedItems[menuItemId]) {
        if (selectedItems[menuItemId].qty > 1) {
            selectedItems[menuItemId].qty -= 1;
        } else {
            delete selectedItems[menuItemId];
        }
        renderSelectedItems();
    }
}

function removeItem(menuItemId) {
    if (selectedItems[menuItemId]) {
        delete selectedItems[menuItemId];
        renderSelectedItems();
    }
}

async function printReceiptDirect() {
    if (!window.printerBackend) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Printer not available. Restart app.");
        } else {
            alert("Printer not available. Restart app.");
        }
        return;
    }

    const now = new Date();
    let text = "";
    text += "===============================\n";
    text += "        CRAVE HUB\n";
    text += "===============================\n\n";
    text += `Customer: ${customerNameInput.value}\n`;
    text += `Date: ${now.toLocaleString()}\n\n`;
    text += "ITEM        QTY   AMOUNT\n";
    text += "-------------------------------\n";

    let total = 0;
    Object.values(selectedItems).forEach(item => {
        const lineTotal = item.qty * item.price;
        total += lineTotal;
        text += `${item.name.padEnd(12).slice(0,12)} ${String(item.qty).padStart(3)}  Rs.${lineTotal.toFixed(2)}\n`;
    });

    text += "-------------------------------\n";
    text += `TOTAL: Rs.${total.toFixed(2)}\n\n`;
    text += "Thank you!\n\n\n";

    try {
        let result = window.printerBackend.print_receipt(text);
        // Handle Promise if returned
        if (result && typeof result.then === 'function') {
            result = await result;
        }

        const res = JSON.parse(result);
        if (!res.success) throw new Error(res.error);
        
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Receipt printed successfully!");
        }
    } catch (e) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Print failed: " + e.message);
        } else {
            alert("Print failed: " + e.message);
        }
    }
}

function buildReceiptText() {
    const now = new Date();
    let text = "";

    text += "================================\n";
    text += "         CRAVE HUB CAFE\n";
    text += "================================\n\n";
    text += `Customer: ${customerNameInput.value}\n`;
    text += `Date: ${now.toLocaleString()}\n\n`;
    text += "ITEM        QTY    AMOUNT\n";
    text += "--------------------------------\n";

    let total = 0;

    Object.values(selectedItems).forEach(item => {
        const lineTotal = item.qty * item.price;
        total += lineTotal;

        text += `${item.name.slice(0,12).padEnd(12)} `;
        text += `${String(item.qty).padStart(3)} `;
        text += `Rs.${lineTotal.toFixed(2)}\n`;
    });

    text += "--------------------------------\n";
    text += `TOTAL: Rs.${total.toFixed(2)}\n\n`;
    text += "Thank you!\n\n\n";

    return text;
}

async function printReceiptNow() {
    if (!window.printerBackend) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Printer backend not available. Restart app.");
        } else {
            alert("Printer backend not available. Restart app.");
        }
        return;
    }

    const receiptText = buildReceiptText();
    
    try {
        let result = window.printerBackend.print_receipt(receiptText);
        // Handle Promise if returned
        if (result && typeof result.then === 'function') {
            result = await result;
        }

        const res = JSON.parse(result);
        if (!res.success) throw new Error(res.error);
        
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Receipt printed successfully!");
        }
    } catch (e) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Printer error: " + e.message);
        } else {
            alert("Printer error: " + e.message);
        }
    }
}


// Save order
async function saveOrder(orderType, total, discountPercent = 0) {
    if (!dbBackend) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Database not initialized");
        } else {
            alert("Database not initialized");
        }
        return;
    }

    try {
        const customerName = customerNameInput ? customerNameInput.value.trim() : '';
        const orderNoteInput = document.getElementById("orderNoteInput");
        const orderNote = orderNoteInput ? orderNoteInput.value.trim() : '';
        const amountReceivedInput = document.getElementById("amountReceivedInput");
        const amountReceived = amountReceivedInput ? parseFloat(amountReceivedInput.value) : null;
        const amountReceivedVal = (amountReceived != null && !isNaN(amountReceived) && amountReceived > 0) ? amountReceived : null;
        const balanceReturnVal = amountReceivedVal != null ? (amountReceivedVal - total) : null;
        const now = new Date().toISOString();
        const insertOrderSql = `INSERT INTO orders (order_type, total, discount_percentage, created_at, customer_name, order_status, payment_status, order_note, amount_received, balance_return) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const result = await safeDbUpdate(insertOrderSql, [orderType, total, discountPercent, now, customerName, 'pending', 'pending', orderNote, amountReceivedVal, balanceReturnVal]);

        console.log("Order insert result:", result);

        if (!result || result.success === false) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Error saving order: " + (result?.error || "Unknown error"));
            } else {
                alert("Error saving order: " + (result?.error || "Unknown error"));
            }
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
                    if (typeof showAlertModal === 'function') {
                        await showAlertModal("Error getting order ID. Please check console for details.");
                    } else {
                        alert("Error getting order ID. Please check console for details.");
                    }
                    return;
                }
            } else {
                if (typeof showAlertModal === 'function') {
                    await showAlertModal("Error getting order ID. Please check console for details.");
                } else {
                    alert("Error getting order ID. Please check console for details.");
                }
                return;
            }
        }

        // Insert order items
        await insertOrderItems(orderId);

        // Show print receipt popup (dark modal – always ask)
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
                console.error("[TAKEAWAY] Error printing receipt:", error);
                if (typeof showAlertModal === 'function') {
                    await showAlertModal("Error printing receipt: " + error.message);
                } else {
                    alert("Error printing receipt: " + error.message);
                }
            }
        }

        // Reset order
        selectedItems = {};
        renderSelectedItems();
        if (customerNameInput) customerNameInput.value = "";
        // Reload takeaway orders table
        loadTakeawayOrders();
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
        const insertItemSql = `INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)`;
        const itemResult = await safeDbUpdate(insertItemSql, [orderId, item.id, item.qty, item.price]);

        if (!itemResult || itemResult.success === false) {
            console.error("Error inserting order item:", itemResult);
            throw new Error("Failed to insert order item: " + (itemResult?.error || "Unknown error"));
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    menuItemsContainer = document.getElementById("menuItems");
    totalAmountEl = document.getElementById("totalAmount");
    const placeOrderBtn = document.getElementById("placeOrderBtn");
    menuSearchInput = document.getElementById("menuSearch");
    customerNameInput = document.getElementById("customerName");

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
        if (!dbBackend) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Database backend not initialized. Please wait...");
            } else {
                alert("Database backend not initialized. Please wait...");
            }
            return;
        }

        const customerName = customerNameInput.value.trim();
        if (!customerName) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Please enter customer name");
            } else {
                alert("Please enter customer name");
            }
            return;
        }

        if (Object.keys(selectedItems).length === 0) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Please select at least one item");
            } else {
                alert("Please select at least one item");
            }
            return;
        }

        // Calculate subtotal
        let subtotal = 0;
        Object.values(selectedItems).forEach(item => {
            subtotal += parseFloat(item.price) * item.qty;
        });

        // Get discount
        const discountInput = document.getElementById("discountInput");
        const discountPercent = discountInput ? parseFloat(discountInput.value) || 0 : 0;
        const discountAmount = (subtotal * discountPercent) / 100;
        const total = subtotal - discountAmount;

        let orderSummary = `Customer: ${customerName}\n\n`;
        Object.values(selectedItems).forEach(item => {
            const itemTotal = parseFloat(item.price) * item.qty;
            orderSummary += `${item.name} x${item.qty} = Rs. ${itemTotal.toFixed(2)}\n`;
        });
        orderSummary += `\nSubtotal: Rs. ${subtotal.toFixed(2)}`;
        if (discountPercent > 0) {
            orderSummary += `\nDiscount (${discountPercent}%): -Rs. ${discountAmount.toFixed(2)}`;
        }
        orderSummary += `\nTotal: Rs. ${total.toFixed(2)}`;

        const confirmed = await showConfirmModal(orderSummary + "\n\nConfirm order?");
        if (confirmed) await saveOrder("Takeaway", total, discountPercent);
    });

    // Wait for global WebChannel to be initialized
    waitForWebChannel();
    
    // Also listen for the webchannel-ready event as a backup
    window.addEventListener('webchannel-ready', () => {
        if (window.dbBackend) {
            dbBackend = window.dbBackend;
            if (!menuItems || menuItems.length === 0) {
                loadMenuItems();
            }
            loadTakeawayOrders();
        }
    });
});

// Load and display all orders in the table
async function loadTakeawayOrders() {
    if (!dbBackend) {
        console.error("Database backend not initialized");
        return;
    }

    try {
        const sql = `
            SELECT id, customer_name, total, created_at, order_status, payment_status
            FROM orders
            WHERE order_type = 'Takeaway'
            ORDER BY created_at DESC
        `;
        const orders = await safeDbQuery(sql);

        const tbody = document.getElementById("takeawayOrdersTableBody");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (!orders || orders.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = '<td colspan="6" style="text-align: center; color: white; padding: 20px;">No takeaway orders found</td>';
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

            // Only show cancel button if order is not completed or cancelled
            const canCancel = status !== 'completed' && status !== 'cancelled';

            tr.innerHTML = `
                <td>#${order.id}</td>
                <td>${order.customer_name || '-'}</td>
                <td>${dateStr} ${timeStr}</td>
                <td>Rs. ${parseFloat(order.total || 0).toFixed(2)}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn-warning" onclick="openEditOrderModal(${order.id})" style="padding: 5px 10px; font-size: 12px; margin-right: 5px;">Edit</button>
                    ${canCancel ? `<button class="btn-danger" onclick="cancelOrder(${order.id})" style="padding: 5px 10px; font-size: 12px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Cancel Order">✕</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading takeaway orders:", error);
        const tbody = document.getElementById("takeawayOrdersTableBody");
        if (tbody) {
            tbody.innerHTML = '<td colspan="6" style="text-align: center; color: #ff6b6b; padding: 20px;">Error loading orders</td>';
        }
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
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Order not found");
        } else {
            alert("Order not found");
        }
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

    modalTitle.textContent = `Edit Takeaway Order #${order.id}`;
    modalTitle.style.color = "white";
    modalContent.innerHTML = `
        <div class="order-modal-body">
            <div class="order-details-section">
                <div class="order-info">
                    <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 10px;">
                        <p style="margin: 0;"><strong>Order ID:</strong> #${order.id}</p>
                        <p style="margin: 0;"><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <p><strong>Customer Name:</strong> <input type="text" id="editCustomerName" value="${order.customer_name || ''}" style="padding: 5px; width: 200px; border-radius: 4px; border: 1px solid #2A2A2A; background-color: white; color: black;"></p>
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
                    <div class="discount-section" style="margin: 15px 0;">
                        <label for="discountInputModal" style="color: white; display: block; margin-bottom: 5px; font-size: 14px;">Discount (%):</label>
                        <input type="number" id="discountInputModal" min="0" max="100" step="0.01" value="${order.discount_percentage || 0}" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background-color: #2a2a2a; color: white; font-size: 14px;" oninput="updateOrderSummaryModal()">
                    </div>
                    <div class="note-section" style="margin: 15px 0;">
                        <label for="orderNoteInputModal" style="color: white; display: block; margin-bottom: 5px; font-size: 14px;">Order Note:</label>
                        <textarea id="orderNoteInputModal" placeholder="Enter order note (optional)" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #444; background-color: #2a2a2a; color: white; font-size: 14px; resize: vertical; min-height: 60px; font-family: inherit;">${order.order_note || ''}</textarea>
                    </div>
                    <div class="order-total">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="color: #aaa;">Subtotal:</span>
                            <span style="color: #aaa;" id="subtotalAmountModal">Rs. 0.00</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;" id="discountRowModal" style="display: none;">
                            <span style="color: #aaa;">Discount:</span>
                            <span style="color: #4caf50;" id="discountAmountModal">Rs. 0.00</span>
                        </div>
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
    const subtotalEl = document.getElementById("subtotalAmountModal");
    const discountInput = document.getElementById("discountInputModal");
    const discountAmountEl = document.getElementById("discountAmountModal");
    const discountRow = document.getElementById("discountRowModal");
    const orderTotal = document.getElementById("orderTotal");

    if (!selectedItemsList) return;

    if (Object.keys(selectedItems).length === 0) {
        selectedItemsList.innerHTML = '<p class="empty-message">No items selected</p>';
        if (subtotalEl) subtotalEl.textContent = 'Rs. 0.00';
        if (discountAmountEl) discountAmountEl.textContent = 'Rs. 0.00';
        if (discountRow) discountRow.style.display = 'none';
        if (orderTotal) orderTotal.textContent = 'Rs. 0.00';
        return;
    }

    let subtotal = 0;
    selectedItemsList.innerHTML = Object.values(selectedItems).map(item => {
        const itemTotal = parseFloat(item.price) * item.qty;
        subtotal += itemTotal;
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

    // Get discount percentage
    const discountPercent = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const total = subtotal - discountAmount;

    // Update display
    if (subtotalEl) subtotalEl.textContent = `Rs. ${subtotal.toFixed(2)}`;
    if (discountAmountEl) discountAmountEl.textContent = `-Rs. ${discountAmount.toFixed(2)}`;
    if (discountRow) discountRow.style.display = discountPercent > 0 ? 'flex' : 'none';
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
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Please select at least one item");
        } else {
            alert("Please select at least one item");
        }
        return;
    }

    if (!currentOrderId || !dbBackend) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Invalid order or database not initialized");
        } else {
            alert("Invalid order or database not initialized");
        }
        return;
    }

    try {
        // Get updated customer name
        const editCustomerNameInput = document.getElementById("editCustomerName");
        const customerName = editCustomerNameInput ? editCustomerNameInput.value.trim() : '';

        // Calculate subtotal
        const subtotal = Object.values(selectedItems).reduce((sum, item) => {
            return sum + (item.price * item.qty);
        }, 0);

        // Get discount
        const discountInput = document.getElementById("discountInputModal");
        const discountPercent = discountInput ? parseFloat(discountInput.value) || 0 : 0;
        const discountAmount = (subtotal * discountPercent) / 100;
        const total = subtotal - discountAmount;

        // Update order
        // Get order note
        const orderNoteInputModal = document.getElementById("orderNoteInputModal");
        const orderNote = orderNoteInputModal ? orderNoteInputModal.value.trim() : '';
        
        const updateOrderSql = `UPDATE orders SET total = ?, discount_percentage = ?, customer_name = ?, order_note = ? WHERE id = ?`;
        await safeDbUpdate(updateOrderSql, [total, discountPercent, customerName, orderNote, currentOrderId]);

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
        loadTakeawayOrders();
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
    if (!currentOrderId || !dbBackend) {
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
                console.error("[TAKEAWAY] Error printing receipt:", error);
                if (typeof showAlertModal === 'function') {
                    await showAlertModal("Error printing receipt: " + error.message);
                } else {
                    alert("Error printing receipt: " + error.message);
                }
            }
        }

        closeOrderModal();
        loadTakeawayOrders();
    } catch (error) {
        console.error("Error marking order complete:", error);
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Error marking order complete: " + error.message);
        } else {
            alert("Error marking order complete: " + error.message);
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Initialize references to DOM elements
    menuItemsContainer = document.getElementById("menuItems");
    totalAmountEl = document.getElementById("totalAmount");
    menuSearchInput = document.getElementById("menuSearch");
    customerNameInput = document.getElementById("customerName");

    // Make functions global for inline buttons
    window.removeItem = removeItem;
    window.increaseQuantity = increaseQuantity;
    window.decreaseQuantity = decreaseQuantity;

    // Wait for global WebChannel to be initialized (already handled above, but keep for safety)
    if (!window._webChannelInitialized) {
        waitForWebChannel();
    }
});


// Cancel order function
async function cancelOrder(orderId) {
    if (!orderId || !dbBackend) {
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

        // Reload orders
        loadTakeawayOrders();
    } catch (error) {
        console.error("Error cancelling order:", error);
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Error cancelling order: " + error.message);
        } else {
            alert("Error cancelling order: " + error.message);
        }
    }
}

// Make functions global
window.openEditOrderModal = openEditOrderModal;
window.closeOrderModal = closeOrderModal;
window.updateOrder = updateOrder;
window.markOrderComplete = markOrderComplete;
window.cancelOrder = cancelOrder;
window.filterMenuItems = filterMenuItems;
window.toggleMenuItem = toggleMenuItem;
window.increaseQuantityModal = increaseQuantityModal;
window.decreaseQuantityModal = decreaseQuantityModal;
window.removeItemModal = removeItemModal;
