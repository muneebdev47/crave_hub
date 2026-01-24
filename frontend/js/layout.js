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

document.addEventListener("DOMContentLoaded", () => {
    const sidebarContainer = document.getElementById("sidebar-container");
    if (sidebarContainer) {
        fetch("sidebar.html")   // 👈 SAME FOLDER as index.html
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to load sidebar: ${res.status}`);
                }
                return res.text();
            })
            .then(html => {
                sidebarContainer.innerHTML = html;
                setActiveLink();
            })
            .catch(err => console.error("Sidebar load failed", err));
    }
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
