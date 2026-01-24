let dbBackend = null;

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
            });
        } catch (error) {
            console.error("Error initializing WebChannel:", error);
        }
    } else {
        console.warn("Qt WebChannel not available.");
    }
}

// Handle login form submission
document.addEventListener("DOMContentLoaded", () => {
    initWebChannel();

    const loginForm = document.getElementById("loginForm");
    const errorMessage = document.getElementById("loginError");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const username = document.getElementById("username").value.trim();
            const password = document.getElementById("password").value.trim();

            if (!username || !password) {
                showError("Please enter both username and password");
                return;
            }

            try {
                // Check for hardcoded admin user first
                if (username === "Admin" && password === "Muneeb@123") {
                    // Store admin user in localStorage
                    localStorage.setItem('currentUser', JSON.stringify({
                        id: 0,
                        username: "Admin",
                        role: "admin"
                    }));

                    // Redirect to dashboard
                    go('dashboard.html');
                    return;
                }

                // Query user from database
                const userSql = `SELECT id, username, role, password FROM users WHERE username = ? AND is_active = 1`;
                const users = await safeDbQuery(userSql, [username]);

                if (!users || users.length === 0) {
                    showError("Invalid username or password");
                    return;
                }

                const user = users[0];

                // Simple password check (in production, use proper hashing)
                // For now, we'll do a simple comparison
                // Note: In a real app, you should hash passwords and compare hashes
                if (user.password === password) {
                    // Store current user in localStorage
                    localStorage.setItem('currentUser', JSON.stringify({
                        id: user.id,
                        username: user.username,
                        role: user.role
                    }));

                    // Redirect to dashboard
                    go('dashboard.html');
                } else {
                    showError("Invalid username or password");
                }
            } catch (error) {
                console.error("Login error:", error);
                showError("An error occurred during login. Please try again.");
            }
        });
    }
});

function showError(message) {
    const errorMessage = document.getElementById("loginError");
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = "block";
        setTimeout(() => {
            errorMessage.style.display = "none";
        }, 5000);
    }
}
