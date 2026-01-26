let users = [];
let filteredUsers = [];
let editingId = null;
let dbBackend = null;
let currentUserIdForModules = null;
let currentUserId = null; // Store current logged-in user ID

// Available modules (matching sidebar)
const AVAILABLE_MODULES = [
    { id: 'dashboard', name: 'Dashboard' },
    { id: 'table_orders', name: 'Table Orders' },
    { id: 'takeaway_orders', name: 'Takeaway Orders' },
    { id: 'delivery_orders', name: 'Delivery Orders' },
    { id: 'finance', name: 'Finance' },
    { id: 'menu', name: 'Menu' },
    { id: 'users', name: 'Users' }
];

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

        if (response && typeof response.then === 'function') {
            response = await response;
        }

        if (typeof response !== 'string') {
            console.error("Invalid response type from database:", typeof response, response);
            return { error: "Invalid response from database" };
        }

        return JSON.parse(response || "{}");
    } catch (error) {
        console.error("Error executing database update:", error, sql);
        return { error: error.message };
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
                loadUsers();
            });
        } catch (error) {
            console.error("Error initializing WebChannel:", error);
        }
    } else {
        console.warn("Qt WebChannel not available. Running in browser mode.");
    }
}

initWebChannel();

// Load users from database
async function loadUsers() {
    if (!dbBackend) {
        console.error("Database backend not initialized");
        setTimeout(loadUsers, 500);
        return;
    }

    try {
        // Get current user from localStorage or default to null
        const currentUserStr = localStorage.getItem('currentUser');
        if (currentUserStr) {
            try {
                const currentUser = JSON.parse(currentUserStr);
                currentUserId = currentUser.id || null;
            } catch (e) {
                console.warn("Could not parse current user from localStorage");
                currentUserId = null;
            }
        }

        const sql = "SELECT id, username, role, is_active, module_access FROM users ORDER BY username";
        const result = await safeDbQuery(sql);
        users = result.map(user => ({
            ...user,
            module_access: user.module_access ? JSON.parse(user.module_access) : []
        }));
        filteredUsers = users;
        renderUserCards();
    } catch (error) {
        console.error("Error loading users:", error);
        users = [];
        filteredUsers = [];
        renderUserCards();
    }
}

// Render user cards
function renderUserCards() {
    const container = document.getElementById("users-cards");
    if (!container) return;

    container.innerHTML = "";

    if (!filteredUsers || filteredUsers.length === 0) {
        container.innerHTML = '<p style="color: #aaa; text-align: center; padding: 20px; grid-column: 1 / -1;">No users found</p>';
        return;
    }

    filteredUsers.forEach(user => {
        const card = document.createElement("div");
        const isActive = user.is_active === 1 || user.is_active === true;
        card.className = `user-card ${!isActive ? 'disabled' : ''}`;
        card.style.cursor = "pointer";

        const moduleCount = user.module_access ? user.module_access.length : 0;

        // Determine if delete button should be shown
        const isAdmin = user.role === 'admin';
        const isCurrentUser = currentUserId && user.id === currentUserId;
        const showDeleteButton = !isAdmin && !isCurrentUser;

        card.innerHTML = `
            <div class="user-card-header">
                <h3>${user.username || 'Unknown User'}</h3>
                <span class="user-status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <p class="user-card-role"><strong>Role:</strong> ${user.role || 'N/A'}</p>
            <p class="user-card-modules"><strong>Module Access:</strong> ${moduleCount} module(s)</p>
            <div class="card-actions">
                <button class="btn-modules" onclick="event.stopPropagation(); openModuleAccessModal(${user.id})">Manage Access</button>
                <button class="btn-toggle" onclick="event.stopPropagation(); toggleUserStatus(${user.id}, ${isActive ? 0 : 1})">
                    ${isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button class="btn-edit" onclick="event.stopPropagation(); editUser(${user.id})">Edit</button>
                ${showDeleteButton ? `<button class="btn-delete" onclick="event.stopPropagation(); deleteUser(${user.id})">Delete</button>` : ''}
            </div>
        `;

        card.addEventListener("click", (e) => {
            if (e.target.tagName === 'BUTTON') return;
            editUser(user.id);
        });

        container.appendChild(card);
    });
}

// Add or update user
document.addEventListener("DOMContentLoaded", () => {
    const addUpdateBtn = document.getElementById("add-update-btn");
    if (!addUpdateBtn) return;

    addUpdateBtn.addEventListener("click", async () => {
        if (!dbBackend) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Database backend not initialized. Please wait...");
            } else {
                alert("Database backend not initialized. Please wait...");
            }
            return;
        }

        const username = document.getElementById("user-username").value.trim();
        const password = document.getElementById("user-password").value.trim();
        const role = document.getElementById("user-role").value;

        if (!username || !password) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Please fill all required fields!");
            } else {
                alert("Please fill all required fields!");
            }
            return;
        }

        try {
            if (editingId) {
                // Update user
                const sql = `UPDATE users SET username = ?, role = ?, password = ? WHERE id = ?`;
                const result = await safeDbUpdate(sql, [username, role, password, editingId]);

                if (result.error || result.success === false) {
                    if (typeof showAlertModal === 'function') {
                        await showAlertModal("Error updating user: " + (result.error || "Unknown error"));
                    } else {
                        alert("Error updating user: " + (result.error || "Unknown error"));
                    }
                    return;
                }

                editingId = null;
                document.getElementById("add-update-btn").innerText = "Add User";
                document.getElementById("add-update-btn").classList.remove("btn-update");
            } else {
                // Insert new user
                const sql = `INSERT INTO users (username, role, password, is_active, module_access) VALUES (?, ?, ?, 1, '[]')`;
                const result = await safeDbUpdate(sql, [username, role, password]);

                if (result.error || result.success === false) {
                    if (typeof showAlertModal === 'function') {
                        await showAlertModal("Error adding user: " + (result.error || "Unknown error"));
                    } else {
                        alert("Error adding user: " + (result.error || "Unknown error"));
                    }
                    return;
                }
            }

            clearForm();
            await loadUsers();

            const searchInput = document.getElementById("user-search");
            if (searchInput) {
                searchInput.value = '';
                filterUsers();
            }
        } catch (error) {
            console.error("Error saving user:", error);
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Error saving user: " + error.message);
            } else {
                alert("Error saving user: " + error.message);
            }
        }
    });

    const clearBtn = document.getElementById("clear-btn");
    if (clearBtn) {
        clearBtn.addEventListener("click", clearForm);
    }

    const searchInput = document.getElementById("user-search");
    if (searchInput) {
        searchInput.addEventListener("input", filterUsers);
    }
});

// Edit user
async function editUser(id) {
    const user = users.find(u => u.id === id);
    if (!user) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("User not found");
        } else {
            alert("User not found");
        }
        return;
    }

    editingId = id;
    document.getElementById("user-id").value = id;
    document.getElementById("user-username").value = user.username;
    document.getElementById("user-password").value = ""; // Don't show password
    document.getElementById("user-role").value = user.role;

    const addUpdateBtn = document.getElementById("add-update-btn");
    addUpdateBtn.innerText = "Update User";
    addUpdateBtn.classList.add("btn-update");

    document.querySelector(".user-form").scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById("user-username").focus();
}

// Delete user
async function deleteUser(id) {
    const user = users.find(u => u.id === id);
    if (!user) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("User not found");
        } else {
            alert("User not found");
        }
        return;
    }

    // Prevent deletion of admin users
    if (user.role === 'admin') {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Cannot delete admin users!");
        } else {
            alert("Cannot delete admin users!");
        }
        return;
    }

    // Prevent deletion of current logged-in user
    if (currentUserId && user.id === currentUserId) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("You cannot delete your own account!");
        } else {
            alert("You cannot delete your own account!");
        }
        return;
    }

    const confirmed = typeof showConfirmModal === 'function'
        ? await showConfirmModal(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)
        : confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`);
    
    if (!confirmed) {
        return;
    }

    if (!dbBackend) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Database backend not initialized. Please wait...");
        } else {
            alert("Database backend not initialized. Please wait...");
        }
        return;
    }

    try {
        const sql = `DELETE FROM users WHERE id = ?`;
        const result = await safeDbUpdate(sql, [id]);

        if (result.error || result.success === false) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Error deleting user: " + (result.error || "Unknown error"));
            } else {
                alert("Error deleting user: " + (result.error || "Unknown error"));
            }
            return;
        }

        if (editingId === id) {
            clearForm();
        }

        await loadUsers();

        const searchInput = document.getElementById("user-search");
        if (searchInput) {
            searchInput.value = '';
            filterUsers();
        }

        if (typeof showAlertModal === 'function') {
            await showAlertModal("User deleted successfully!");
        } else {
            alert("User deleted successfully!");
        }
    } catch (error) {
        console.error("Error deleting user:", error);
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Error deleting user: " + error.message);
        } else {
            alert("Error deleting user: " + error.message);
        }
    }
}

// Toggle user status
async function toggleUserStatus(id, newStatus) {
    if (!dbBackend) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Database backend not initialized. Please wait...");
        } else {
            alert("Database backend not initialized. Please wait...");
        }
        return;
    }

    try {
        const sql = `UPDATE users SET is_active = ? WHERE id = ?`;
        const result = await safeDbUpdate(sql, [newStatus, id]);

        if (result.error || result.success === false) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Error updating user status: " + (result.error || "Unknown error"));
            } else {
                alert("Error updating user status: " + (result.error || "Unknown error"));
            }
            return;
        }

        await loadUsers();

        const searchInput = document.getElementById("user-search");
        if (searchInput) {
            searchInput.value = '';
        }
    } catch (error) {
        console.error("Error toggling user status:", error);
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Error updating user status: " + error.message);
        } else {
            alert("Error updating user status: " + error.message);
        }
    }
}

// Filter users
function filterUsers() {
    const searchInput = document.getElementById("user-search");
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (searchTerm === '') {
        filteredUsers = users;
    } else {
        filteredUsers = users.filter(user =>
            (user.username && user.username.toLowerCase().includes(searchTerm)) ||
            (user.role && user.role.toLowerCase().includes(searchTerm))
        );
    }

    renderUserCards();
}

// Open module access modal
async function openModuleAccessModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("User not found");
        } else {
            alert("User not found");
        }
        return;
    }

    currentUserIdForModules = userId;
    const modal = document.getElementById("moduleAccessModal");
    const modalTitle = document.getElementById("moduleModalTitle");
    const modalUser = document.getElementById("moduleModalUser");
    const moduleList = document.getElementById("moduleAccessList");

    modalTitle.textContent = `Module Access - ${user.username}`;
    modalUser.textContent = `Configure module access for: ${user.username} (${user.role})`;

    // Render module checkboxes
    const currentModules = user.module_access || [];
    moduleList.innerHTML = AVAILABLE_MODULES.map(module => {
        const isChecked = currentModules.includes(module.id);
        return `
            <label class="module-checkbox-label">
                <input type="checkbox" class="module-checkbox" value="${module.id}" ${isChecked ? 'checked' : ''}>
                <span>${module.name}</span>
            </label>
        `;
    }).join('');

    modal.style.display = "block";
}

// Close module access modal
function closeModuleAccessModal() {
    const modal = document.getElementById("moduleAccessModal");
    modal.style.display = "none";
    currentUserIdForModules = null;
}

// Save module access
async function saveModuleAccess() {
    if (!currentUserIdForModules) return;

    if (!dbBackend) {
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Database backend not initialized. Please wait...");
        } else {
            alert("Database backend not initialized. Please wait...");
        }
        return;
    }

    try {
        const checkboxes = document.querySelectorAll('.module-checkbox:checked');
        const selectedModules = Array.from(checkboxes).map(cb => cb.value);
        const moduleAccessJson = JSON.stringify(selectedModules);

        const sql = `UPDATE users SET module_access = ? WHERE id = ?`;
        const result = await safeDbUpdate(sql, [moduleAccessJson, currentUserIdForModules]);

        if (result.error || result.success === false) {
            if (typeof showAlertModal === 'function') {
                await showAlertModal("Error updating module access: " + (result.error || "Unknown error"));
            } else {
                alert("Error updating module access: " + (result.error || "Unknown error"));
            }
            return;
        }

        await loadUsers();
        closeModuleAccessModal();
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Module access updated successfully!");
        } else {
            alert("Module access updated successfully!");
        }
    } catch (error) {
        console.error("Error saving module access:", error);
        if (typeof showAlertModal === 'function') {
            await showAlertModal("Error saving module access: " + error.message);
        } else {
            alert("Error saving module access: " + error.message);
        }
    }
}

// Clear form
function clearForm() {
    document.getElementById("user-id").value = "";
    document.getElementById("user-username").value = "";
    document.getElementById("user-password").value = "";
    document.getElementById("user-role").value = "staff";
    editingId = null;
    const addUpdateBtn = document.getElementById("add-update-btn");
    addUpdateBtn.innerText = "Add User";
    addUpdateBtn.classList.remove("btn-update");
}

// Make functions globally accessible
window.editUser = editUser;
window.deleteUser = deleteUser;
window.toggleUserStatus = toggleUserStatus;
window.openModuleAccessModal = openModuleAccessModal;
window.closeModuleAccessModal = closeModuleAccessModal;
window.saveModuleAccess = saveModuleAccess;

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById("moduleAccessModal");
    if (event.target === modal) {
        closeModuleAccessModal();
    }
}
