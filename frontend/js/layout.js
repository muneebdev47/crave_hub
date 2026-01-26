// Define go() function globally
window.go = function (page) {
    // For PyQt WebEngine, use file:// protocol
    if (page.startsWith('http://') || page.startsWith('https://') || page.startsWith('file://')) {
        window.location.href = page;
    } else {
        // Convert relative path to file:// URL
        const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
        window.location.href = basePath + page;
    }
};

// Also define it without window for compatibility
function go(page) {
    window.go(page);
}

// Module mapping: page file -> module ID
const MODULE_MAPPING = {
    'dashboard.html': 'dashboard',
    'table_orders.html': 'table_orders',
    'takeaway_orders.html': 'takeaway_orders',
    'delivery_orders.html': 'delivery_orders',
    'finance.html': 'finance',
    'menu.html': 'menu',
    'users.html': 'users'
};

// Sidebar items configuration
const SIDEBAR_ITEMS = [
    { page: 'dashboard.html', icon: '../assets/icons/dashboard.png', label: 'Dashboard', module: 'dashboard' },
    { page: 'table_orders.html', icon: '../assets/icons/table.png', label: 'Table Orders', module: 'table_orders' },
    { page: 'takeaway_orders.html', icon: '../assets/icons/take_away_orders.png', label: 'Takeway Orders', module: 'takeaway_orders' },
    { page: 'delivery_orders.html', icon: '../assets/icons/delivery.png', label: 'Delivery Orders', module: 'delivery_orders' },
    { page: 'finance.html', icon: '../assets/icons/finance.png', label: 'Finance', module: 'finance' },
    { page: 'menu.html', icon: '../assets/icons/menu.png', label: 'Menu', module: 'menu' },
    { page: 'users.html', icon: '../assets/icons/users.png', label: 'Users', module: 'users' }
];

// Helper function to safely execute database queries
async function safeDbQuery(sql, params = null) {
    if (!window.dbBackend) {
        console.error("Database backend not initialized");
        return [];
    }

    try {
        let response;

        if (params && Array.isArray(params) && params.length > 0) {
            const paramsJson = JSON.stringify(params);
            response = window.dbBackend.execute_with_params(sql, paramsJson);
        } else {
            response = window.dbBackend.execute_query(sql);
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

// Get user's module access
async function getUserModuleAccess() {
    try {
        const currentUserStr = localStorage.getItem('currentUser');
        if (!currentUserStr) {
            return 'all'; // No user logged in, show all (shouldn't happen, but safe fallback)
        }

        const currentUser = JSON.parse(currentUserStr);
        
        // Admin user (id: 0) has access to all modules
        if (currentUser.id === 0) {
            return 'all'; // Special value meaning all modules
        }

        // Check if module_access is already in localStorage (from login)
        if (currentUser.module_access !== undefined) {
            if (currentUser.module_access === 'all') {
                return 'all';
            }
            if (Array.isArray(currentUser.module_access)) {
                return currentUser.module_access;
            }
        }

        // If not in localStorage, get from database (fallback)
        if (!window.dbBackend) {
            console.warn("Database backend not available, showing all modules");
            return 'all';
        }

        const sql = `SELECT module_access FROM users WHERE id = ?`;
        const result = await safeDbQuery(sql, [currentUser.id]);
        
        if (Array.isArray(result) && result.length > 0) {
            const moduleAccess = result[0].module_access;
            if (moduleAccess) {
                try {
                    const parsed = JSON.parse(moduleAccess);
                    // Update localStorage with the fetched module_access
                    currentUser.module_access = parsed;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    return parsed;
                } catch (e) {
                    console.error("Error parsing module_access:", e);
                    return [];
                }
            }
        }

        return [];
    } catch (error) {
        console.error("Error getting user module access:", error);
        return 'all'; // Default to all modules on error
    }
}

// Build sidebar HTML based on module access
async function buildSidebar() {
    const sidebarContainer = document.getElementById("sidebar-container");
    if (!sidebarContainer) return;

    const moduleAccess = await getUserModuleAccess();
    
    // Build sidebar HTML
    let sidebarHTML = `
        <aside class="sidebar">
            <img src="../assets/logo.png" alt="Crave Hub Logo" class="brand-logo">
            <ul class="nav-links">
    `;

    // Add menu items based on module access
    SIDEBAR_ITEMS.forEach(item => {
        // Show item if user has access to all modules (admin) or has this specific module
        const hasAccess = moduleAccess === 'all' || 
                         (Array.isArray(moduleAccess) && moduleAccess.includes(item.module));
        
        if (hasAccess) {
            sidebarHTML += `
                <li>
                    <button onclick="go('${item.page}')">
                        <img src="${item.icon}" class="nav-icon" alt="${item.label}">
                        ${item.label}
                    </button>
                </li>
            `;
        }
    });

    // Always show logout button
    sidebarHTML += `
                <li>
                    <button onclick="logout()">
                        <img src="../assets/icons/logout.png" class="nav-icon" alt="Logout">
                        Logout
                    </button>
                </li>
            </ul>
        </aside>
    `;

    sidebarContainer.innerHTML = sidebarHTML;
    setActiveLink();
}

// Wait for WebChannel and build sidebar
function waitForWebChannelAndBuildSidebar() {
    if (window._webChannelInitialized && window.dbBackend) {
        buildSidebar();
    } else {
        // Wait a bit and try again
        setTimeout(waitForWebChannelAndBuildSidebar, 100);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Try to build sidebar immediately (will use cached data or show all if no user)
    buildSidebar();
    
    // Also listen for webchannel-ready event to rebuild with proper module access
    window.addEventListener('webchannel-ready', () => {
        setTimeout(() => {
            buildSidebar();
        }, 100);
    });
    
    // Also try waiting for WebChannel
    waitForWebChannelAndBuildSidebar();
});

function setActiveLink() {
    const current = window.location.pathname.split("/").pop();
    document.querySelectorAll(".nav-links button").forEach(btn => {
        const action = btn.getAttribute("onclick");
        if (action && action.includes(current)) {
            btn.classList.add("active");
        }
    });
}

// Logout function - clears session and navigates to login
function logout() {
    // Clear any stored user data
    localStorage.removeItem('currentUser');
    localStorage.clear();
    
    // Navigate to login page
    go('login.html');
}

// Make logout globally accessible
window.logout = logout;
