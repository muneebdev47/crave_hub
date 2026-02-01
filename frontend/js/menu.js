let menuItems = [];
let filteredMenuItems = [];
let editingId = null;
let dbBackend = null;
let menuBackend = null;
/** When editing/adding a deal: array of { menu_item_id, name, quantity } */
let dealItemsForForm = [];

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

// Initialize Qt WebChannel - wait for QWebChannel to be available
function initWebChannel() {
    if (typeof QWebChannel === 'undefined') {
        // Wait for QWebChannel to load
        setTimeout(initWebChannel, 100);
        return;
    }

    if (typeof qt !== 'undefined' && qt.webChannelTransport) {
        try {
            new QWebChannel(qt.webChannelTransport, function (channel) {
                window.menuBackend = channel.objects.menuBackend;
                window.dbBackend = channel.objects.dbBackend;
                menuBackend = channel.objects.menuBackend;
                dbBackend = channel.objects.dbBackend;
                loadMenuItems();
            });
        } catch (error) {
            console.error("Error initializing WebChannel:", error);
        }
    } else {
        console.warn("Qt WebChannel not available. Running in browser mode.");
        // Fallback for browser testing - you can mock the backend here if needed
    }
}

// Start initialization
initWebChannel();

// Load menu items directly from database using SQL
async function loadMenuItems() {
    if (!dbBackend) {
        console.error("Database backend not initialized");
        setTimeout(loadMenuItems, 500);
        return;
    }

    try {
        // Direct SQL query to menu_items table - order by category and name
        const sql = "SELECT id, name, category, price, is_available, COALESCE(is_deal, 0) as is_deal FROM menu_items ORDER BY category, name";
        const result = await safeDbQuery(sql);
        menuItems = result;
        filteredMenuItems = result;
        renderMenuCards();
    } catch (error) {
        console.error("Error loading menu items:", error);
        menuItems = [];
        filteredMenuItems = [];
        renderMenuCards();
    }
}

// Render menu cards
function renderMenuCards() {
    const container = document.getElementById("menu-cards");
    if (!container) return;

    container.innerHTML = "";

    const itemsToRender = filteredMenuItems.length > 0 ? filteredMenuItems : menuItems;

    if (!itemsToRender || itemsToRender.length === 0) {
        container.innerHTML = '<p style="color: #aaa; text-align: center; padding: 20px; grid-column: 1 / -1;">No menu items found</p>';
        return;
    }

    itemsToRender.forEach(item => {
        const card = document.createElement("div");
        const isAvailable = item.is_available === 1 || item.is_available === true;
        card.className = `menu-card ${!isAvailable ? 'disabled' : ''}`;
        card.style.cursor = "pointer";

        const isDeal = item.is_deal === 1 || item.is_deal === true;
        card.innerHTML = `
            <div class="menu-card-header">
                <h3>${item.name || 'Unknown Item'}</h3>
                <span class="menu-status-badge ${isAvailable ? 'available' : 'unavailable'}">${isAvailable ? 'Available' : 'Disabled'}</span>
                ${isDeal ? '<span class="menu-status-badge" style="background:#ff9800;">Deal</span>' : ''}
            </div>
            <p class="menu-card-category"><strong>Category:</strong> ${item.category || 'Uncategorized'}</p>
            <p class="menu-card-price"><strong>Price:</strong> Rs. ${parseFloat(item.price || 0).toFixed(2)}</p>
            <div class="card-actions">
                <button class="btn-toggle" onclick="event.stopPropagation(); toggleItemAvailability(${item.id}, ${isAvailable ? 0 : 1})">
                    ${isAvailable ? 'Disable' : 'Enable'}
                </button>
                <button class="btn-delete" onclick="event.stopPropagation(); deleteItem(${item.id})">Delete</button>
            </div>
        `;

        // Click on card to edit
        card.addEventListener("click", (e) => {
            // Don't trigger if clicking on buttons
            if (e.target.tagName === 'BUTTON') return;
            editItem(item.id);
        });

        container.appendChild(card);
    });
}

// Toggle deal section visibility
function toggleDealSection() {
    const isDeal = document.getElementById("menu-is-deal").checked;
    const section = document.getElementById("deal-items-section");
    if (section) section.style.display = isDeal ? "block" : "none";
    if (isDeal) renderDealItemsList();
}

// Render the list of items in the deal
function renderDealItemsList() {
    const list = document.getElementById("deal-items-list");
    if (!list) return;
    if (dealItemsForForm.length === 0) {
        list.innerHTML = '<p style="color:#888;font-size:13px;">No items added. Select an item below and click "Add to deal".</p>';
        return;
    }
    list.innerHTML = dealItemsForForm.map((row, idx) => `
        <div class="deal-items-list-item" data-index="${idx}">
            <span>${row.name} x ${row.quantity}</span>
            <button type="button" class="btn-deal-remove" data-index="${idx}">Remove</button>
        </div>
    `).join('');
    list.querySelectorAll(".btn-deal-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            const idx = parseInt(btn.getAttribute("data-index"), 10);
            dealItemsForForm.splice(idx, 1);
            renderDealItemsList();
        });
    });
}

// Add manually entered item to deal
function addItemToDeal() {
    const nameInput = document.getElementById("deal-item-name");
    const qtyInput = document.getElementById("deal-item-qty");
    if (!nameInput || !qtyInput) return;
    const name = nameInput.value.trim();
    const qty = parseInt(qtyInput.value, 10) || 1;
    if (!name) {
        alert("Enter item name (e.g. 1 Small Pizza, 350 ml Drink).");
        return;
    }
    if (qty < 1) {
        alert("Enter quantity (at least 1).");
        return;
    }
    dealItemsForForm.push({ name, quantity: qty });
    renderDealItemsList();
    nameInput.value = "";
    qtyInput.value = "1";
    nameInput.focus();
}

// Add or update item
document.addEventListener("DOMContentLoaded", () => {
    const addUpdateBtn = document.getElementById("add-update-btn");
    if (!addUpdateBtn) return;

    const isDealCheck = document.getElementById("menu-is-deal");
    if (isDealCheck) isDealCheck.addEventListener("change", toggleDealSection);

    const dealAddBtn = document.getElementById("deal-add-item-btn");
    if (dealAddBtn) dealAddBtn.addEventListener("click", addItemToDeal);

    addUpdateBtn.addEventListener("click", async () => {
        if (!dbBackend) {
            alert("Database backend not initialized. Please wait...");
            return;
        }

        const name = document.getElementById("menu-name").value.trim();
        const category = document.getElementById("menu-category").value.trim();
        const price = parseFloat(document.getElementById("menu-price").value.trim());
        const isDeal = document.getElementById("menu-is-deal").checked;

        if (!name || !category || isNaN(price) || price <= 0) {
            alert("Please fill all fields correctly! Price must be greater than 0.");
            return;
        }
        if (isDeal && dealItemsForForm.length === 0) {
            alert("Please add at least one menu item to this deal.");
            return;
        }

        try {
            const isDealInt = isDeal ? 1 : 0;
            if (editingId) {
                const sql = `UPDATE menu_items SET name = ?, category = ?, price = ?, is_deal = ? WHERE id = ?`;
                const result = await safeDbUpdate(sql, [name, category, price, isDealInt, editingId]);
                if (result.error || result.success === false) {
                    alert("Error updating item: " + (result.error || "Unknown error"));
                    return;
                }
                const dealId = editingId;
                if (isDeal) {
                    await safeDbUpdate("DELETE FROM deal_items WHERE deal_id = ?", [dealId]);
                    for (const row of dealItemsForForm) {
                        await safeDbUpdate("INSERT INTO deal_items (deal_id, menu_item_id, item_name, quantity) VALUES (?, ?, ?, ?)", [dealId, null, row.name, row.quantity]);
                    }
                } else {
                    await safeDbUpdate("DELETE FROM deal_items WHERE deal_id = ?", [dealId]);
                }
                editingId = null;
                document.getElementById("add-update-btn").innerText = "Add Item";
                document.getElementById("add-update-btn").classList.remove("btn-update");
            } else {
                const sql = `INSERT INTO menu_items (name, category, price, is_available, is_deal) VALUES (?, ?, ?, 1, ?)`;
                const result = await safeDbUpdate(sql, [name, category, price, isDealInt]);
                if (result.error || result.success === false) {
                    alert("Error adding item: " + (result.error || "Unknown error"));
                    return;
                }
                const newId = result.last_insert_id || result.lastInsertId;
                if (isDeal && newId) {
                    for (const row of dealItemsForForm) {
                        await safeDbUpdate("INSERT INTO deal_items (deal_id, menu_item_id, item_name, quantity) VALUES (?, ?, ?, ?)", [newId, null, row.name, row.quantity]);
                    }
                }
            }

            clearForm();
            await loadMenuItems();

            const searchInput = document.getElementById("menu-search");
            if (searchInput) {
                searchInput.value = '';
                filterMenuItems();
            }
        } catch (error) {
            console.error("Error saving item:", error);
            alert("Error saving item: " + error.message);
        }
    });
});

// Edit - populate form when card is clicked
async function editItem(id) {
    const item = menuItems.find(i => i.id === id);
    if (!item) {
        alert("Item not found");
        return;
    }

    editingId = id;
    document.getElementById("menu-id").value = id;
    document.getElementById("menu-name").value = item.name;
    document.getElementById("menu-category").value = item.category;
    document.getElementById("menu-price").value = item.price;
    const isDeal = item.is_deal === 1 || item.is_deal === true;
    document.getElementById("menu-is-deal").checked = isDeal;

    dealItemsForForm = [];
    if (isDeal && dbBackend) {
        const rows = await safeDbQuery("SELECT di.quantity, COALESCE(di.item_name, mi.name) as name FROM deal_items di LEFT JOIN menu_items mi ON mi.id = di.menu_item_id WHERE di.deal_id = ? ORDER BY di.id", [id]);
        dealItemsForForm = (rows || []).map(r => ({ name: r.name || '', quantity: r.quantity || 1 }));
    }
    toggleDealSection();
    if (isDeal) renderDealItemsList();

    const addUpdateBtn = document.getElementById("add-update-btn");
    addUpdateBtn.innerText = "Update Item";
    addUpdateBtn.classList.add("btn-update");

    document.querySelector(".menu-form").scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById("menu-name").focus();
}

// Delete
async function deleteItem(id) {
    const item = menuItems.find(i => i.id === id);
    if (!item) {
        alert("Item not found");
        return;
    }

    if (!confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
        return;
    }

    if (!dbBackend) {
        alert("Database backend not initialized. Please wait...");
        return;
    }

    try {
        // Delete using direct SQL
        const sql = `DELETE FROM menu_items WHERE id = ?`;
        const result = await safeDbUpdate(sql, [id]);

        if (result.error || result.success === false) {
            alert("Error deleting item: " + (result.error || "Unknown error"));
            return;
        }

        // If we were editing this item, clear the form
        if (editingId === id) {
            clearForm();
        }

        await loadMenuItems();

        // Clear search if active
        const searchInput = document.getElementById("menu-search");
        if (searchInput) {
            searchInput.value = '';
            filterMenuItems();
        }

        alert("Item deleted successfully!");
    } catch (error) {
        console.error("Error deleting item:", error);
        alert("Error deleting item: " + error.message);
    }
}

// Toggle item availability (enable/disable)
async function toggleItemAvailability(id, newStatus) {
    if (!dbBackend) {
        alert("Database backend not initialized. Please wait...");
        return;
    }

    try {
        const sql = `UPDATE menu_items SET is_available = ? WHERE id = ?`;
        const result = await safeDbUpdate(sql, [newStatus, id]);

        if (result.error || result.success === false) {
            alert("Error updating item availability: " + (result.error || "Unknown error"));
            return;
        }

        // Reload menu items (will only show available items)
        await loadMenuItems();

        // Clear search if active
        const searchInput = document.getElementById("menu-search");
        if (searchInput) {
            searchInput.value = '';
        }
    } catch (error) {
        console.error("Error toggling item availability:", error);
        alert("Error updating item availability: " + error.message);
    }
}

// Search functionality
function filterMenuItems() {
    const searchInput = document.getElementById("menu-search");
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (searchTerm === '') {
        filteredMenuItems = menuItems;
    } else {
        filteredMenuItems = menuItems.filter(item =>
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            (item.category && item.category.toLowerCase().includes(searchTerm))
        );
    }

    renderMenuCards();
}

// Clear form
document.addEventListener("DOMContentLoaded", () => {
    const clearBtn = document.getElementById("clear-btn");
    if (clearBtn) {
        clearBtn.addEventListener("click", clearForm);
    }

    // Search input listener
    const searchInput = document.getElementById("menu-search");
    if (searchInput) {
        searchInput.addEventListener("input", filterMenuItems);
    }
});

function clearForm() {
    document.getElementById("menu-id").value = "";
    document.getElementById("menu-name").value = "";
    document.getElementById("menu-category").value = "";
    document.getElementById("menu-price").value = "";
    const isDealCheck = document.getElementById("menu-is-deal");
    if (isDealCheck) isDealCheck.checked = false;
    dealItemsForForm = [];
    const section = document.getElementById("deal-items-section");
    if (section) section.style.display = "none";
    const list = document.getElementById("deal-items-list");
    if (list) list.innerHTML = "";
    editingId = null;
    const addUpdateBtn = document.getElementById("add-update-btn");
    addUpdateBtn.innerText = "Add Item";
    addUpdateBtn.classList.remove("btn-update");
}

// Make functions global
window.editItem = editItem;
window.deleteItem = deleteItem;
window.toggleItemAvailability = toggleItemAvailability;
